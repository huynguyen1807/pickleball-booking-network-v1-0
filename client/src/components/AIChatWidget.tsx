import { useState, useRef, useEffect, FormEvent } from 'react'
import s from '../styles/AIChatWidget.module.css'

/* ────────────────────── types ────────────────────── */
interface Message {
    id: number
    role: 'bot' | 'user'
    text: string
    time: string
}

/* ────────────────────── knowledge base ────────────────────── */
const KB: { keywords: string[]; answer: string }[] = [
    {
        keywords: ['đặt sân', 'book', 'booking', 'dat san', 'đặt lịch', 'thuê sân'],
        answer:
            'Để đặt sân, bạn vào mục **Sân** → chọn cơ sở → chọn sân và khung giờ phù hợp → nhấn **Đặt sân** và thanh toán. Hệ thống sẽ xác nhận qua thông báo ngay!',
    },
    {
        keywords: ['giá', 'bao nhiêu', 'chi phí', 'phí', 'price', 'gia'],
        answer:
            'Giá sân tùy thuộc vào cơ sở và khung giờ. Bạn có thể xem giá chi tiết khi chọn sân trong mục **Cơ sở**. Giá thường dao động từ 80.000 – 200.000 VNĐ/giờ.',
    },
    {
        keywords: ['thanh toán', 'payment', 'trả tiền', 'chuyển khoản', 'payos'],
        answer:
            'Chúng tôi hỗ trợ thanh toán qua **PayOS** (chuyển khoản ngân hàng, QR code). Sau khi đặt sân, bạn sẽ được chuyển đến trang thanh toán an toàn.',
    },
    {
        keywords: ['hủy', 'cancel', 'hoàn tiền', 'refund', 'huy'],
        answer:
            'Bạn có thể hủy lịch đặt trước **2 giờ** so với giờ chơi. Vào **Dashboard** → **Lịch đặt** → chọn lịch cần hủy → nhấn **Hủy**. Tiền sẽ được hoàn theo chính sách của cơ sở.',
    },
    {
        keywords: ['ghép trận', 'matchmaking', 'tìm đối', 'ghép đôi', 'tim doi', 'ghep tran'],
        answer:
            'Tính năng **Ghép trận** giúp bạn tìm đối thủ phù hợp! Vào mục **Ghép trận** → tạo hoặc tham gia trận đấu → hệ thống sẽ thông báo khi có người tham gia.',
    },
    {
        keywords: ['tài khoản', 'đăng ký', 'register', 'account', 'dang ky', 'tạo tài khoản'],
        answer:
            'Để đăng ký tài khoản, nhấn **Đăng ký** tại trang đăng nhập → điền thông tin (email, mật khẩu, tên) → xác nhận. Bạn có thể đăng nhập ngay sau khi đăng ký!',
    },
    {
        keywords: ['mật khẩu', 'quên mật khẩu', 'forgot', 'password', 'mat khau', 'đổi mật khẩu'],
        answer:
            'Nếu quên mật khẩu, nhấn **Quên mật khẩu** ở trang đăng nhập → nhập email → kiểm tra hộp thư để đặt lại mật khẩu. Bạn cũng có thể đổi mật khẩu trong **Cài đặt**.',
    },
    {
        keywords: ['cơ sở', 'facility', 'sân', 'co so', 'địa điểm', 'dia diem'],
        answer:
            'Bạn có thể xem danh sách tất cả cơ sở Pickleball trong mục **Cơ sở**. Mỗi cơ sở hiển thị địa chỉ, số sân, giá, và đánh giá từ người chơi khác.',
    },
    {
        keywords: ['bài viết', 'post', 'đăng bài', 'chia sẻ', 'dang bai'],
        answer:
            'Bạn có thể đăng bài chia sẻ khoảnh khắc chơi Pickleball! Nhấn nút **Tạo bài viết** trên trang chủ → thêm ảnh/nội dung → nhấn **Đăng**. Bài viết sẽ hiển thị trên feed cho mọi người thấy.',
    },
    {
        keywords: ['chủ sân', 'owner', 'chu san', 'đăng ký chủ sân', 'quản lý sân'],
        answer:
            'Nếu bạn là chủ sân, vào **Dashboard chủ sân** để quản lý cơ sở, sân, và lịch đặt. Bạn có thể thêm cơ sở mới, tạo sân, và theo dõi doanh thu.',
    },
    {
        keywords: ['thông báo', 'notification', 'thong bao'],
        answer:
            'Bạn sẽ nhận thông báo khi có đặt sân mới, ghép trận thành công, hoặc có người nhắn tin. Nhấn biểu tượng 🔔 trên thanh điều hướng để xem tất cả thông báo.',
    },
    {
        keywords: ['chat', 'nhắn tin', 'tin nhắn', 'nhan tin', 'message'],
        answer:
            'Bạn có thể nhắn tin trực tiếp với người chơi khác hoặc chủ sân! Vào mục **Chat** trên thanh điều hướng để bắt đầu cuộc trò chuyện.',
    },
    {
        keywords: ['báo cáo', 'report', 'vi phạm', 'bao cao', 'tố cáo'],
        answer:
            'Nếu phát hiện nội dung vi phạm, nhấn nút **Báo cáo** (⚠️) trên bài viết → chọn lý do → gửi. Đội ngũ admin sẽ xem xét trong thời gian sớm nhất.',
    },
    {
        keywords: ['pickleball', 'luật', 'luat', 'cách chơi', 'quy tắc'],
        answer:
            'Pickleball là môn thể thao kết hợp tennis, cầu lông và bóng bàn. Sân nhỏ hơn tennis, dùng vợt gỗ/composite và bóng nhựa có lỗ. Trận đấu thường chơi đến 11 điểm, thắng cách 2 điểm!',
    },
    {
        keywords: ['liên hệ', 'contact', 'hỗ trợ', 'support', 'lien he', 'ho tro', 'giúp'],
        answer:
            'Bạn có thể liên hệ đội ngũ hỗ trợ qua:\n• **Chat**: Nhắn tin trực tiếp với Admin\n• **Email**: support@pickleballdn.vn\n• Hoặc mô tả vấn đề ngay tại đây, mình sẽ cố gắng giúp bạn! 😊',
    },
    {
        keywords: ['xin chào', 'hello', 'hi', 'hey', 'chào', 'alo'],
        answer:
            'Xin chào bạn! 👋 Mình là trợ lý AI của **Pickleball Đà Nẵng**. Mình có thể giúp bạn:\n• Đặt sân & thanh toán\n• Ghép trận tìm đối\n• Hướng dẫn sử dụng\n• Giải đáp thắc mắc\n\nBạn cần hỗ trợ gì nào?',
    },
    {
        keywords: ['cảm ơn', 'thank', 'cam on', 'thanks'],
        answer:
            'Không có gì ạ! 😊 Rất vui vì đã giúp được bạn. Nếu cần thêm hỗ trợ, đừng ngại hỏi mình nhé! Chúc bạn chơi Pickleball vui vẻ! 🏓',
    },
]

const FALLBACK =
    'Xin lỗi, mình chưa hiểu câu hỏi của bạn 😅. Bạn có thể hỏi về:\n• Đặt sân & thanh toán\n• Ghép trận tìm đối\n• Tài khoản & cài đặt\n• Luật chơi Pickleball\n\nHoặc nhấn vào gợi ý phía dưới nhé!'

const QUICK_REPLIES = [
    'Cách đặt sân?',
    'Ghép trận',
    'Giá sân',
    'Thanh toán',
    'Liên hệ hỗ trợ',
]

/* ────────────────────── helpers ────────────────────── */
function now() {
    return new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

function removeVietnameseTones(str: string) {
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
}

function getAIResponse(input: string): string {
    const normalized = removeVietnameseTones(input.toLowerCase().trim())
    let bestMatch: (typeof KB)[0] | null = null
    let bestScore = 0

    for (const entry of KB) {
        let score = 0
        for (const kw of entry.keywords) {
            const nkw = removeVietnameseTones(kw)
            if (normalized.includes(nkw)) {
                score += nkw.length // longer match = more relevant
            }
        }
        if (score > bestScore) {
            bestScore = score
            bestMatch = entry
        }
    }

    return bestMatch && bestScore > 0 ? bestMatch.answer : FALLBACK
}

let _id = 0

/* ────────────────────── component ────────────────────── */
export default function AIChatWidget() {
    const [open, setOpen] = useState(false)
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [typing, setTyping] = useState(false)
    const [unread, setUnread] = useState(0)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const hasGreeted = useRef(false)

    /* scroll to bottom on new message */
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, typing])

    /* greet on first open */
    useEffect(() => {
        if (open && !hasGreeted.current) {
            hasGreeted.current = true
            setTyping(true)
            setTimeout(() => {
                setMessages([
                    {
                        id: ++_id,
                        role: 'bot',
                        text: 'Xin chào! 👋 Mình là trợ lý AI của **Pickleball Đà Nẵng**. Mình có thể giúp bạn đặt sân, ghép trận, hoặc giải đáp thắc mắc. Bạn cần gì nào? 😊',
                        time: now(),
                    },
                ])
                setTyping(false)
            }, 800)
        }
        if (open) {
            setUnread(0)
            setTimeout(() => inputRef.current?.focus(), 100)
        }
    }, [open])

    /* send message */
    const send = (text?: string) => {
        const msg = (text ?? input).trim()
        if (!msg) return

        const userMsg: Message = { id: ++_id, role: 'user', text: msg, time: now() }
        setMessages((prev) => [...prev, userMsg])
        setInput('')

        /* simulate AI "thinking" */
        setTyping(true)
        const delay = 600 + Math.random() * 800
        setTimeout(() => {
            const reply = getAIResponse(msg)
            const botMsg: Message = { id: ++_id, role: 'bot', text: reply, time: now() }
            setMessages((prev) => [...prev, botMsg])
            setTyping(false)
            if (!open) setUnread((u) => u + 1)
        }, delay)
    }

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault()
        send()
    }

    /* simple markdown bold */
    const renderText = (text: string) => {
        const parts = text.split(/(\*\*[^*]+\*\*)/g)
        return parts.map((p, i) => {
            if (p.startsWith('**') && p.endsWith('**')) {
                return <strong key={i}>{p.slice(2, -2)}</strong>
            }
            // handle newlines
            return p.split('\n').map((line, j, arr) => (
                <span key={`${i}-${j}`}>
                    {line}
                    {j < arr.length - 1 && <br />}
                </span>
            ))
        })
    }

    return (
        <>
            {/* ── Chat window ── */}
            {open && (
                <div className={s.chatWindow} id="ai-chat-window">
                    {/* Header */}
                    <div className={s.chatHeader}>
                        <div className={s.chatAvatar}>🤖</div>
                        <div className={s.chatHeaderInfo}>
                            <h4>Trợ lý AI Pickleball</h4>
                            <span>
                                <i className={s.onlineDot} /> Luôn sẵn sàng hỗ trợ
                            </span>
                        </div>
                        <button
                            className={s.chatClose}
                            onClick={() => setOpen(false)}
                            aria-label="Đóng chat"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Messages */}
                    <div className={s.chatMessages}>
                        {messages.map((m) => (
                            <div
                                key={m.id}
                                className={`${s.message} ${
                                    m.role === 'bot' ? s.messageBot : s.messageUser
                                }`}
                            >
                                {m.role === 'bot' && (
                                    <div className={s.msgAvatar}>🤖</div>
                                )}
                                <div>
                                    <div className={s.msgBubble}>{renderText(m.text)}</div>
                                    <div className={s.msgTime}>{m.time}</div>
                                </div>
                            </div>
                        ))}

                        {/* Typing indicator */}
                        {typing && (
                            <div className={s.typingIndicator}>
                                <div className={s.msgAvatar}>🤖</div>
                                <div className={s.typingBubble}>
                                    <span />
                                    <span />
                                    <span />
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Quick replies */}
                    {messages.length <= 1 && !typing && (
                        <div className={s.quickReplies}>
                            {QUICK_REPLIES.map((q) => (
                                <button
                                    key={q}
                                    className={s.quickReply}
                                    onClick={() => send(q)}
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Input */}
                    <form className={s.chatInput} onSubmit={handleSubmit}>
                        <input
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Nhập tin nhắn..."
                            autoComplete="off"
                            id="ai-chat-input"
                        />
                        <button
                            type="submit"
                            className={s.sendBtn}
                            disabled={!input.trim()}
                            aria-label="Gửi"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13" />
                                <polygon points="22 2 15 22 11 13 2 9 22 2" />
                            </svg>
                        </button>
                    </form>
                </div>
            )}

            {/* ── Floating toggle button ── */}
            <button
                className={s.chatToggle}
                onClick={() => setOpen(!open)}
                aria-label={open ? 'Đóng chat hỗ trợ' : 'Mở chat hỗ trợ'}
                id="ai-chat-toggle"
            >
                {open ? (
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                ) : (
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                )}
                {unread > 0 && !open && <span className={s.badge}>{unread}</span>}
            </button>
        </>
    )
}
