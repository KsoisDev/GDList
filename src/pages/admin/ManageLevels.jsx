import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Edit3, Trash2, Save, X } from 'lucide-react'
import PageShell from '../../components/layout/PageShell'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Badge from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'
import { useAuth } from '../../hooks/useAuth'
import {
  getCollection, createDocument, updateDocument, deleteDocument,
  where,
} from '../../services/firestore'
import { DIFFICULTIES, DIFFICULTY_COLORS } from '../../utils/constants'
import styles from './Admin.module.css'

export default function ManageLevels() {
  const { user, userData, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [levels, setLevels] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', creator: '', verifier: '', difficulty: 'insane', points: 100, description: '' })
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!authLoading && (!user || userData?.role !== 'admin')) navigate('/')
  }, [user, userData, authLoading, navigate])

  const loadLevels = async () => {
    setLoading(true)
    try {
      const data = await getCollection('levels', [
        where('type', '==', 'community'),
      ])
      setLevels(data.sort((a, b) => a.position - b.position))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (userData?.role === 'admin') loadLevels() }, [userData])

  const handleSave = async () => {
    if (!form.name || !form.creator) return
    setSaving(true)
    try {
      const data = {
        ...form,
        type: 'community',
        position: levels.length + 1,
        isActive: true,
        points: Number(form.points),
      }
      if (editing) {
        await updateDocument('levels', editing, data)
      } else {
        await createDocument('levels', `community_${Date.now()}`, data)
      }
      setForm({ name: '', creator: '', verifier: '', difficulty: 'insane', points: 100, description: '' })
      setEditing(null)
      await loadLevels()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (level) => {
    setForm({
      name: level.name,
      creator: level.creator,
      verifier: level.verifier || '',
      difficulty: level.difficulty?.toLowerCase() || 'insane',
      points: level.points || 100,
      description: level.description || '',
    })
    setEditing(level.id)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this level?')) return
    try {
      await deleteDocument('levels', id)
      await loadLevels()
    } catch (err) {
      console.error(err)
    }
  }

  const handleMove = async (id, direction) => {
    const idx = levels.findIndex(l => l.id === id)
    if (idx === -1) return
    const newIdx = idx + direction
    if (newIdx < 0 || newIdx >= levels.length) return
    const temp = [...levels]
    const currentPos = temp[idx].position
    temp[idx].position = temp[newIdx].position
    temp[newIdx].position = currentPos
    const [moved] = temp.splice(idx, 1)
    temp.splice(newIdx, 0, moved)
    setLevels(temp)
    await Promise.all([
      updateDocument('levels', temp[idx].id, { position: temp[idx].position }),
      updateDocument('levels', temp[newIdx].id, { position: temp[newIdx].position }),
    ])
  }

  if (authLoading || loading) {
    return <PageShell><div className={styles.loading}><Spinner size="lg" /></div></PageShell>
  }

  const diffOptions = DIFFICULTIES.map(d => ({ value: d.id, label: `${d.label} (${d.points} pts)` }))

  return (
    <PageShell title="Manage Community Levels" subtitle="Add, edit, reorder, and remove community levels">
      <Card padding="md" className={styles.formCard}>
        <h3 className={styles.formTitle}>{editing ? 'Edit Level' : 'Add New Level'}</h3>
        <div className={styles.formGrid}>
          <Input label="Level Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Level name" />
          <Input label="Creator" value={form.creator} onChange={e => setForm({ ...form, creator: e.target.value })} placeholder="Creator name" />
          <Input label="Verifier" value={form.verifier} onChange={e => setForm({ ...form, verifier: e.target.value })} placeholder="Verifier name" />
          <Select label="Difficulty" options={diffOptions} value={form.difficulty} onChange={e => setForm({ ...form, difficulty: e.target.value })} />
          <Input label="Points" type="number" value={form.points} onChange={e => setForm({ ...form, points: e.target.value })} />
          <Input label="Description (optional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Brief description" />
        </div>
        <div className={styles.formActions}>
          <Button variant="primary" size="sm" onClick={handleSave} loading={saving} icon={editing ? Save : Plus}>
            {editing ? 'Update' : 'Add Level'}
          </Button>
          {editing && (
            <Button variant="ghost" size="sm" onClick={() => { setEditing(null); setForm({ name: '', creator: '', verifier: '', difficulty: 'insane', points: 100, description: '' }) }} icon={X}>
              Cancel
            </Button>
          )}
        </div>
      </Card>

      <div className={styles.table}>
        <div className={styles.tableHeader}>
          <span>Pos</span>
          <span>Name</span>
          <span>Creator</span>
          <span>Difficulty</span>
          <span>Points</span>
          <span>Actions</span>
        </div>
        {levels.map((level, i) => (
          <motion.div key={level.id} className={styles.tableRow}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
          >
            <span className={styles.position}>#{level.position}</span>
            <span className={styles.name}>{level.name}</span>
            <span className={styles.creator}>{level.creator}</span>
            <span><Badge size="sm" style={{ color: DIFFICULTY_COLORS[level.difficulty?.toLowerCase()] }}>{level.difficulty}</Badge></span>
            <span className={styles.points}>{level.points}</span>
            <span className={styles.actions}>
              <Button variant="ghost" size="sm" onClick={() => handleMove(level.id, -1)} disabled={i === 0}>↑</Button>
              <Button variant="ghost" size="sm" onClick={() => handleMove(level.id, 1)} disabled={i === levels.length - 1}>↓</Button>
              <Button variant="ghost" size="sm" onClick={() => handleEdit(level)} icon={Edit3} />
              <Button variant="ghost" size="sm" onClick={() => handleDelete(level.id)} icon={Trash2} />
            </span>
          </motion.div>
        ))}
      </div>
    </PageShell>
  )
}
