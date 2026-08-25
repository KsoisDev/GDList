import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Edit3, Trash2, Save, X } from 'lucide-react'
import PageShell from '../../components/layout/PageShell'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Spinner from '../../components/ui/Spinner'
import { useAuth } from '../../hooks/useAuth'
import { getCollection, createDocument, updateDocument, deleteDocument } from '../../services/firestore'
import { invalidateCache } from '../../services/readCache'
import { hasAccess } from '../../utils/constants'
import styles from './Admin.module.css'

const COLOR_PRESETS = ['#4ade80', '#60a5fa', '#f59e0b', '#ef4444', '#a78bfa', '#22d3ee', '#f472b6', '#fb923c', '#34d399', '#facc15']

export default function ManageTags() {
  const { user, userData, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', color: COLOR_PRESETS[0] })
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!authLoading && (!user || !hasAccess(userData?.role || 'user', 'admin'))) navigate('/')
  }, [user, userData, authLoading, navigate])

  const load = async () => {
    setLoading(true)
    try {
      const data = await getCollection('tags')
      setTags(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (hasAccess(userData?.role || 'user', 'admin')) load() }, [userData])

  const handleSave = async () => {
    if (!form.name.trim()) return
    if (saving) return
    setSaving(true)
    try {
      if (editing) {
        await updateDocument('tags', editing, { name: form.name.trim(), color: form.color })
      } else {
        await createDocument('tags', null, { name: form.name.trim(), color: form.color })
      }
      setForm({ name: '', color: COLOR_PRESETS[0] })
      setEditing(null)
      invalidateCache('tags')
      await load()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (tag) => {
    setForm({ name: tag.name, color: tag.color || COLOR_PRESETS[0] })
    setEditing(tag.id)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this tag? Levels tagged with it will keep no tag reference.')) return
    try {
      await deleteDocument('tags', id)
      invalidateCache('tags')
      await load()
    } catch (err) {
      console.error(err)
    }
  }

  if (authLoading || loading) {
    return <PageShell><div className={styles.loading}><Spinner size="lg" /></div></PageShell>
  }

  return (
    <PageShell title="Manage Tags" subtitle="Create and edit level tags (name and color)">
      <Card padding="md" className={styles.formCard}>
        <h3 className={styles.formTitle}>{editing ? 'Edit Tag' : 'Add New Tag'}</h3>
        <div className={styles.formGrid}>
          <Input
            label="Tag Name"
            placeholder="e.g. Memory, Crimson, Entry Extreme"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
          />
          <div>
            <span className={styles.tagColorLabel}>Color</span>
            <div className={styles.tagColorRow}>
              <input
                type="color"
                className={styles.tagColorInput}
                value={form.color}
                onChange={e => setForm({ ...form, color: e.target.value })}
                aria-label="Custom tag color"
              />
              {COLOR_PRESETS.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`${styles.tagSwatch} ${form.color === c ? styles.tagSwatchActive : ''}`}
                  style={{ background: c }}
                  onClick={() => setForm({ ...form, color: c })}
                  aria-label={`Set color ${c}`}
                >
                  {form.color === c && <span className={styles.tagSwatchCheck}>✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className={styles.formActions}>
          <Button variant="primary" size="sm" onClick={handleSave} loading={saving} icon={editing ? Save : Plus}>
            {editing ? 'Update Tag' : 'Add Tag'}
          </Button>
          {editing && (
            <Button variant="ghost" size="sm" onClick={() => { setEditing(null); setForm({ name: '', color: COLOR_PRESETS[0] }) }} icon={X}>
              Cancel
            </Button>
          )}
        </div>
      </Card>

      {tags.length === 0 ? (
        <Card padding="lg" className={styles.emptyCard}>
          <p>No tags yet. Create one above.</p>
        </Card>
      ) : (
        <div className={styles.tagsTable}>
          {tags.map((tag, i) => (
            <motion.div key={tag.id} className={styles.tagsRow}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i, 12) * 0.02 }}
            >
              <span className={styles.tagPreview} style={{ background: tag.color || '#888' }}>
                {tag.name}
              </span>
              <span className={styles.tagId}>{tag.id}</span>
              <span className={styles.tagsActions}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEdit(tag)}
                  icon={Edit3}
                  aria-label={`Edit ${tag.name}`}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(tag.id)}
                  icon={Trash2}
                  aria-label={`Delete ${tag.name}`}
                />
              </span>
            </motion.div>
          ))}
        </div>
      )}
    </PageShell>
  )
}
