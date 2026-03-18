import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import styles from '../styles/Dialog.module.css';

type DialogType = 'alert' | 'confirm';

interface DialogOptions {
    title?: string;
    message: string;
    type?: DialogType;
    confirmText?: string;
    cancelText?: string;
}

interface DialogContextType {
    showAlert: (titleOrMessage: string, message?: string) => Promise<void>;
    showConfirm: (titleOrMessage: string, message?: string) => Promise<boolean>;
}

const DialogContext = createContext<DialogContextType>({
    showAlert: async () => {},
    showConfirm: async () => false,
});

export const useDialog = () => useContext(DialogContext);

export const DialogProvider = ({ children }: { children: ReactNode }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState<DialogOptions>({ message: '', type: 'alert' });
    const [resolveFn, setResolveFn] = useState<(value: boolean) => void>(() => {});

    const openDialog = useCallback((opts: DialogOptions) => {
        setOptions(opts);
        setIsOpen(true);
        return new Promise<boolean>((resolve) => {
            setResolveFn(() => resolve);
        });
    }, []);

    const showAlert = useCallback(async (titleOrMessage: string, message?: string) => {
        const title = message ? titleOrMessage : 'Thông báo';
        const msg = message ? message : titleOrMessage;
        await openDialog({ title, message: msg, type: 'alert', confirmText: 'OK' });
    }, [openDialog]);

    const showConfirm = useCallback(async (titleOrMessage: string, message?: string) => {
        const title = message ? titleOrMessage : 'Xác nhận';
        const msg = message ? message : titleOrMessage;
        return await openDialog({ title, message: msg, type: 'confirm', confirmText: 'Xác nhận', cancelText: 'Hủy' });
    }, [openDialog]);

    const handleConfirm = () => {
        setIsOpen(false);
        resolveFn(true);
    };

    const handleCancel = () => {
        setIsOpen(false);
        resolveFn(false);
    };

    return (
        <DialogContext.Provider value={{ showAlert, showConfirm }}>
            {children}
            {isOpen && (
                <div className={styles.overlay}>
                    <div className={styles.dialog}>
                        <div className={styles.header}>
                            <h3 className={styles.title}>{options.title}</h3>
                            <button className={styles.closeButton} onClick={handleCancel}>&times;</button>
                        </div>
                        <div className={styles.content}>
                            <p>{options.message}</p>
                        </div>
                        <div className={styles.footer}>
                            {options.type === 'confirm' && (
                                <button className={`btn btn-secondary ${styles.button}`} onClick={handleCancel}>
                                    {options.cancelText || 'Hủy'}
                                </button>
                            )}
                            <button className={`btn btn-primary ${styles.button}`} onClick={handleConfirm}>
                                {options.confirmText || 'OK'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DialogContext.Provider>
    );
};
