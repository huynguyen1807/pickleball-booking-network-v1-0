import { Request, Response, NextFunction } from 'express';
import { TokenPayload } from '../types';

interface AuthRequest extends Request {
    user?: TokenPayload;
}

const role = (...roles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) return res.status(401).json({ message: 'Chưa đăng nhập' });
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Không có quyền truy cập' });
        }
        next();
    };
};

export default role;
