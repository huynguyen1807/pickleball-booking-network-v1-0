# TypeScript Migration - Hướng dẫn hoàn thiện

## ✅ Đã hoàn thành

### Server (Backend)
- ✅ Đã cài TypeScript và type definitions
- ✅ Đã tạo tsconfig.json
- ✅ Đã đổi tên tất cả .js → .ts  
- ✅ Đã convert sang ES6 modules (import/export)
- ✅ Đã convert:
  - Middleware (auth.ts, role.ts)
  - All routes (11 files) 
  - All controllers (11 files)
  - Config (db.ts)
  - Socket (index.ts)
  - Types definitions

### Client (Frontend)
- ✅ Đã cài TypeScript và @types/react
- ✅ Đã tạo tsconfig.json và tsconfig.node.json
- ✅ Đã đổi tên tất cả .jsx → .tsx và .js → .ts
- ✅ Đã thêm types cho:
  - AuthContext.tsx
  - ProtectedRoute.tsx
  - src/types/index.ts

## 🔧 Cần làm tiếp

### 1. Hoàn thiện type annotations cho components còn lại

Các components cần thêm types cho props và state:

```tsx
// Pattern cơ bản:
import { useState } from 'react';
import { User, Court } from '../types';

interface ComponentProps {
    someProp: string;
    optional?: number;
}

export default function ComponentName({ someProp, optional }: ComponentProps) {
    const [data, setData] = useState<Court[]>([]);
    // ...
}
```

**Danh sách components cần sửa:**
- [ ] src/components/Navbar.tsx
- [ ] src/components/CourtCard.tsx  
- [ ] src/components/MatchCard.tsx
- [ ] src/components/PostCard.tsx
- [ ] src/components/ChatBox.tsx
- [ ] All pages (21 files)

### 2. Thêm types cho API calls

File `src/api/axios.ts` cần generic types:

```typescript
import { AxiosResponse } from 'axios';

export const api = {
  get: <T,>(url: string) => axios.get<T>(url),
  post: <T,>(url: string, data?: any) => axios.post<T>(url, data),
  // ...
};
```

### 3. Fix các type errors còn lại

Chạy lệnh check errors:
```bash
# Server
cd sever
npx tsc --noEmit

# Client  
cd client
npx tsc --noEmit
```

### 4. Thêm JSDoc cho các functions quan trọng

```typescript
/**
 * Register a new user
 * @param req Express request
 * @param res Express response
 */
export const register = async (req: Request, res: Response) => {
  // ...
}
```

## 🚀 Chạy ứng dụng

### Server (TypeScript)
```bash
cd sever
npm run dev          # Dev mode với ts-node-dev
npm run build        # Compile to JavaScript
npm start            # Run compiled code
```

### Client (vẫn dùng Vite)
```bash
cd client  
npm run dev
```

## 📝 Lưu ý

1. **Strict mode đang tắt** trong server/tsconfig.json để dễ migration. Sau khi hoàn thiện, nên bật lại:
   ```json
   "strict": true,
   "noImplicitAny": true,
   "strictNullChecks": true
   ```

2. **Một số patterns hay dùng:**
   - `Partial<User>` - tất cả properties là optional
   - `Pick<User, 'id' | 'email'>` - chỉ lấy một số fields
   - `Omit<User, 'password'>` - bỏ một số fields

3. **Event handlers trong React:**
   ```typescript
   const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
     // ...
   };
   
   const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     // ...
   };
   ```

## 🛠 Scripts hỗ trợ

Đã tạo các scripts trong folder `sever/`:
- `convert-routes.ps1` - Convert routes (đã chạy)
- `convert-controllers.ps1` - Convert controllers (đã chạy)

Bạn có thể tạo thêm scripts tương tự cho client components nếu cần.

## ✨ Lợi ích đã đạt được

- Type safety: Catch errors at compile time
- Better IDE support: Autocomplete, quick fixes
- Self-documenting code
- Easier refactoring
- Better collaboration

Hãy tiếp tục migration từng phần một. Mỗi lần sửa một file, chạy `tsc --noEmit` để check errors!
