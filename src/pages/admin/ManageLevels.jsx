import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Sortable from 'sortablejs'
import { Plus, Edit3, Trash2, Save, X, RefreshCw, GripVertical } from 'lucide-react'
import PageShell from '../../components/layout/PageShell'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Spinner from '../../components/ui/Spinner'
import { useAuth } from '../../hooks/useAuth'
import { updateDocument, getCollection } from '../../services/firestore'
import {
  getCommunityLevels, insertCommunityLevel, deleteCommunityLevel, moveCommunityLevel,
  setCommunityPosition, renumberCommunityLevels,
} from '../../services/communityList'
import { hasAccess } from '../../utils/constants'
import styles from './Admin.module.css'

export default function ManageLevels() {
  const { user, userData, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [levels, setLevels] = useState([])
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', creator: '', verifier: '', gameId: '', description: '', position: '', videoURL: '', tags: [] })
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const inFlightRef = useRef(false)
  const listRef = useRef(null)

  useEffect(() => {
    if (!authLoading && (!user || !hasAccess(userData?.role || 'user', 'admin'))) navigate('/')
  }, [user, userData, authLoading, navigate])

  useEffect(() => {
    if (!listRef.current) return
    const sortable = Sortable.create(listRef.current, {
      handle: '.dragHandle',
      animation: 150,
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass: 'sortable-drag',
      onEnd: async (evt) => {
        if (evt.oldIndex == null || evt.newIndex == null || evt.oldIndex === evt.newIndex) return
        const ids = Array.from(listRef.current.querySelectorAll('[data-id]'))
          .map(el => el.getAttribute('data-id'))
          .filter(Boolean)
        const ordered = ids
          .map(id => levels.find(l => l.id === id))
          .filter(Boolean)
          .filter(l => (l.victoryCount || 0) > 0)
        try {
          await renumberCommunityLevels(ordered, false, true)
          await loadLevels()
        } catch (err) {
          console.error(err)
        }
      },
    })
    return () => sortable.destroy()
  }, [levels])

  const loadLevels = async () => {
    setLoading(true)
    try {
      const data = await getCommunityLevels()
      setLevels(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (hasAccess(userData?.role || 'user', 'admin')) {
      loadLevels()
      getCollection('tags')
        .then(data => setTags(data))
        .catch(err => console.error('Failed to load tags:', err))
    }
  }, [userData])

  const emptyForm = { name: '', creator: '', verifier: '', gameId: '', description: '', position: '', videoURL: '', tags: [] }

  const toggleTag = (id) => {
    setForm(prev => ({
      ...prev,
      tags: prev.tags.includes(id) ? prev.tags.filter(t => t !== id) : [...prev.tags, id],
    }))
  }

  const handleSave = async () => {
    if (!form.name || !form.creator) return
    if (inFlightRef.current) return
    inFlightRef.current = true
    setSaving(true)
    try {
      if (editing) {
        await updateDocument('levels', editing, {
          name: form.name,
          creator: form.creator,
          verifier: form.verifier,
          gameId: form.gameId,
          description: form.description,
          videoURL: form.videoURL,
          tags: form.tags,
        })
        const edited = levels.find(l => l.id === editing)
        if (form.position && edited && (edited.victoryCount || 0) > 0) {
          await setCommunityPosition(editing, Number(form.position))
        }
      } else {
        await insertCommunityLevel(
          `community_${Date.now()}`,
          {
            type: 'community',
            name: form.name,
            creator: form.creator,
            verifier: form.verifier,
            gameId: form.gameId,
            description: form.description,
            videoURL: form.videoURL,
            isActive: true,
            victoryCount: 0,
            victors: [],
            tags: form.tags,
            thumbnail: '',
          },
          form.position ? Number(form.position) : undefined
        )
      }
      setForm(emptyForm)
      setEditing(null)
      await loadLevels()
    } catch (err) {
      console.error(err)
    } finally {
      inFlightRef.current = false
      setSaving(false)
    }
  }

  const handleEdit = (level) => {
    setForm({
      name: level.name,
      creator: level.creator,
      verifier: level.verifier || '',
      gameId: level.gameId || '',
      description: level.description || '',
      position: level.position || '',
      videoURL: level.videoURL || '',
      tags: level.tags || [],
    })
    setEditing(level.id)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this level?')) return
    try {
      await deleteCommunityLevel(id)
      await loadLevels()
    } catch (err) {
      console.error(err)
    }
  }

  const handleMove = async (id, direction) => {
    try {
      await moveCommunityLevel(id, direction)
      await loadLevels()
    } catch (err) {
      console.error(err)
    }
  }

  const handleRenumber = async () => {
    if (!confirm('Renumber all community levels (1..n) and recalculate points by position?')) return
    try {
      await renumberCommunityLevels(null, false, true)
      await loadLevels()
    } catch (err) {
      console.error(err)
    }
  }

  if (authLoading || loading) {
    return <PageShell><div className={styles.loading}><Spinner size="lg" /></div></PageShell>
  }

  return (
    <PageShell title="Manage Community Levels" subtitle="Add, edit, reorder, and remove community levels">
      <Card padding="md" className={styles.formCard}>
        <h3 className={styles.formTitle}>{editing ? 'Edit Level' : 'Add New Level'}</h3>
        <div className={styles.formGrid}>
          <Input label="Level Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Level name" />
          <Input label="Creator" value={form.creator} onChange={e => setForm({ ...form, creator: e.target.value })} placeholder="Creator name" />
          <Input label="Verifier" value={form.verifier} onChange={e => setForm({ ...form, verifier: e.target.value })} placeholder="Verifier name" />
          <Input label="Level ID (in-game)" value={form.gameId} onChange={e => setForm({ ...form, gameId: e.target.value })} placeholder="e.g. 10565740" />
          <Input label="Position (blank = end)" type="number" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} placeholder="e.g. 1" />
          <Input label="Showcase Video URL" type="url" value={form.videoURL} onChange={e => setForm({ ...form, videoURL: e.target.value })} placeholder="https://youtu.be/..." />
          <Input label="Description (optional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Brief description" />
        </div>
        {tags.length > 0 && (
          <div className={styles.levelTagsField}>
            <span className={styles.tagColorLabel}>Tags</span>
            <div className={styles.tagChips}>
              {tags.map(tag => {
                const active = form.tags.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    type="button"
                    className={`${styles.formTagChip} ${active ? styles.formTagChipActive : ''}`}
                    style={active ? { background: tag.color, borderColor: tag.color } : undefined}
                    onClick={() => toggleTag(tag.id)}
                  >
                    {tag.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}
        <div className={styles.formActions}>
          <Button variant="primary" size="sm" onClick={handleSave} loading={saving} icon={editing ? Save : Plus}>
            {editing ? 'Update' : 'Add Level'}
          </Button>
          {editing && (
            <Button variant="ghost" size="sm" onClick={() => { setEditing(null); setForm(emptyForm) }} icon={X}>
              Cancel
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleRenumber} icon={RefreshCw}>
            Renumber List
          </Button>
        </div>
      </Card>

      <div className={styles.table}>
        <div className={styles.tableHeader}>
          <span></span>
          <span>Pos</span>
          <span>Name</span>
          <span>Creator</span>
          <span>Tags</span>
          <span>ID</span>
          <span>Points</span>
          <span>Actions</span>
        </div>
        <div ref={listRef}>
        {levels.map((level, i) => (
          <motion.div key={level.id} className={styles.tableRow} data-id={level.id}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
          >
            {(level.victoryCount || 0) > 0 ? (
              <span className={styles.dragHandle} title="Drag to reorder">
                <GripVertical size={16} />
              </span>
            ) : (
              <span className={styles.dragHandleEmpty} />
            )}
            <span className={styles.position}>
              {(level.victoryCount || 0) === 0 ? '—' : `#${level.position}`}
            </span>
            <span className={styles.name}>{level.name}</span>
            <span className={styles.creator}>{level.creator}</span>
            <span className={styles.tableTags}>
              {(level.tags || []).map(tid => {
                const tag = tags.find(t => t.id === tid)
                return tag ? (
                  <span key={tid} className={styles.miniTag} style={{ background: tag.color }}>
                    {tag.name}
                  </span>
                ) : null
              })}
            </span>
            <span className={styles.gameId}>{level.gameId || '—'}</span>
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
      </div>
    </PageShell>
  )
}
