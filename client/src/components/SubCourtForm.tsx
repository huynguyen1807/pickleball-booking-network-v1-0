import { useState } from 'react'
import api from '../api/axios'

type Props = {
  courtId?: string | number | null
  subCourt?: any
  onClose: () => void
  onSuccess: () => any
}

export default function SubCourtForm({ courtId, subCourt, onClose, onSuccess }: Props) {
  const [form, setForm] = useState({
    name: subCourt?.name || '',
    court_type: subCourt?.court_type || 'indoor',
    surface_type: subCourt?.surface_type || 'hard',
    status: subCourt?.status || 'active',
    price_per_hour: subCourt?.price_per_hour ?? 0
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!form.name) return alert('Nhập tên sân')
    
    setLoading(true)
    setError('')

    try {
      const payload = { ...form }
      if (subCourt) {
        if (!courtId) throw new Error('courtId required to update')
        await api.put(`/courts/${courtId}/sub-courts/${subCourt.id}`, payload)
      } else {
        if (!courtId) throw new Error('courtId required to create')
        await api.post(`/courts/${courtId}/sub-courts`, payload)
      }

      onSuccess()
      onClose()
    } catch (err) {
      const message = err.response?.data?.message || 'Cập nhập thất bại'
      setError(message)
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="glass-card">
      <h3>{subCourt ? '✏️ Sửa sân con' : '➕ Thêm sân con'}</h3>

      <input
        placeholder="Tên sân"
        value={form.name}
        onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
      />

      <select
        value={form.court_type}
        onChange={e => setForm(p => ({ ...p, court_type: e.target.value }))}
      >
        <option value="indoor">Trong nhà</option>
        <option value="outdoor">Ngoài trời</option>
        <option value="roofed">Có mái che</option>
      </select>

      <select
        value={form.surface_type}
        onChange={e => setForm(p => ({ ...p, surface_type: e.target.value }))}
      >
        <option value="hard">Sân cứng</option>
        <option value="carpet">Sân thảm</option>
      </select>

      <div style={{ marginTop: 8 }}>
        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Giá (/giờ)</label>
        <input
          type="number"
          step="0.01"
          min={0}
          className="input-field"
          value={form.price_per_hour}
          onChange={e => setForm(p => ({ ...p, price_per_hour: parseFloat(e.target.value || '0') }))}
        />
      </div>

      {subCourt && (
        <select
          value={form.status}
          onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
        >
          <option value="active">Hoạt động</option>
          <option value="maintenance">Bảo trì</option>
        </select>
      )}

      {error && <div style={{ color: '#ef4444', marginBottom: 12 }}>⚠️ {error}</div>}

      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button 
          className="btn btn-primary" 
          onClick={submit}
          disabled={loading}
        >
          {loading ? 'Đang lưu...' : 'Lưu'}
        </button>
        <button 
          className="btn btn-secondary" 
          onClick={onClose}
          disabled={loading}
        >
          Hủy
        </button>
      </div>
    </div>
  )
}