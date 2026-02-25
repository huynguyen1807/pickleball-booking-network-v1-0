const role = (...roles) => {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ message: 'Chưa đăng nhập' });
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Không có quyền truy cập' });
        }
        next();
    };
};

module.exports = role;
