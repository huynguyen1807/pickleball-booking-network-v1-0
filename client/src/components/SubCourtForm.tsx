import { useState } from 'react'
import api from '../api/axios'

export default function SubCourtForm({ courtId, subCourt, onClose, onSuccess }) {
  const [form, setForm] = useState({
    name: subCourt?.name || '',
    court_type: subCourt?.court_type || 'indoor',
    surface_type: subCourt?.surface_type || 'hard',
    status: subCourt?.status || 'active'
  })

  const submit = async () => {
    if (!form.name) return alert('Nhập tên sân')

    if (subCourt) {
      await api.put(`/sub-courts/${subCourt.id}`, form)
    } else {
      await api.post(`/courts/${courtId}/sub-courts`, form)
    }

    onClose()
    onSuccess()
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

      {subCourt && (
        <select
          value={form.status}
          onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
        >
          <option value="active">Hoạt động</option>
          <option value="maintenance">Bảo trì</option>
        </select>
      )}

      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" onClick={submit}>Lưu</button>
        <button className="btn btn-secondary" onClick={onClose}>Hủy</button>
      </div>
    </div>
  )
}