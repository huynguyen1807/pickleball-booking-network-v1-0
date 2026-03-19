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
    price_per_hour: subCourt?.price_per_hour ?? 0,
    peak_start_time: subCourt?.peak_start_time || '17:00',
    peak_end_time: subCourt?.peak_end_time || '21:00',
    peak_price_per_hour: subCourt?.peak_price_per_hour ?? 0,
    weekend_price_per_hour: subCourt?.weekend_price_per_hour ?? 0,
    min_booking_minutes: subCourt?.min_booking_minutes ?? 60,
    slot_step_minutes: subCourt?.slot_step_minutes ?? 15
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!form.name) return setError('Nhập tên sân')

    if (form.peak_start_time || form.peak_end_time || form.peak_price_per_hour) {
        if (!form.peak_start_time || !form.peak_end_time || !form.peak_price_per_hour) {
            return setError('Vui lòng điền đầy đủ Giờ bắt đầu, Giờ kết thúc và Giá cho Khung giờ vàng')
        }
        if (form.peak_start_time >= form.peak_end_time) {
            return setError('Giờ bắt đầu khung giờ vàng phải trước Giờ kết thúc')
        }
    }
    
    setLoading(true)
    setError('')

    try {
      const payload = { ...form ,
      peak_start_time: form.peak_start_time + ':00',
      peak_end_time: form.peak_end_time + ':00'
      }
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
        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Giá cơ bản (/giờ)</label>
        <input
          type="number"
          step="0.01"
          min={0}
          className="input-field"
          value={form.price_per_hour}
          onChange={e => setForm(p => ({ ...p, price_per_hour: parseFloat(e.target.value || '0') }))}
        />
      </div>

      <div style={{ marginTop: 8 }}>
        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Khung giờ vàng</label>
        <div style={{display:'flex', gap:8}}>
          <input type="time" value={form.peak_start_time}
                 onChange={e=>setForm(p=>({...p,peak_start_time:e.target.value}))}
                 className="input-field" style={{flex:1}}/>
          <span style={{alignSelf:'center'}}>→</span>
          <input type="time" value={form.peak_end_time}
                 onChange={e=>setForm(p=>({...p,peak_end_time:e.target.value}))}
                 className="input-field" style={{flex:1}}/>
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Giá giờ vàng (/giờ)</label>
        <input type="number" step="0.01" min={0} className="input-field"
               value={form.peak_price_per_hour}
               onChange={e=>setForm(p=>({...p,peak_price_per_hour:parseFloat(e.target.value)||0}))}/>
      </div>

      <div style={{ marginTop: 8 }}>
        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Giá cuối tuần (/giờ)</label>
        <input type="number" step="0.01" min={0} className="input-field"
               value={form.weekend_price_per_hour}
               onChange={e=>setForm(p=>({...p,weekend_price_per_hour:parseFloat(e.target.value)||0}))}/>
      </div>

      <div style={{ marginTop: 8 }}>
        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Min. mỗi slot (phút)</label>
        <input type="number" min={15} className="input-field"
               value={form.min_booking_minutes}
               onChange={e=>setForm(p=>({...p,min_booking_minutes:parseInt(e.target.value)||30}))}/>
      </div>

      <div style={{ marginTop: 8 }}>
        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Bước nhảy (phút)</label>
        <input type="number" min={15} className="input-field"
               value={form.slot_step_minutes}
               onChange={e=>setForm(p=>({...p,slot_step_minutes:parseInt(e.target.value)||15}))}/>
      </div>

      {/* {subCourt && (
        <select
          value={form.status}
          onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
        >
          <option value="active">Hoạt động</option>
          <option value="maintenance">Bảo trì</option>
        </select>
      )} */}

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