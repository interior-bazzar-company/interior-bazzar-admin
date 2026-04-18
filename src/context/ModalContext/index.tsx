import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import Modal from "../../components/overlays/Modal";

// Define types for the context values
interface ModalConfig {
    width?: string;
    maxWidth?: string;
}

interface ModalContextType {
    showModal: (content: React.ReactNode, config?: ModalConfig) => void;
    closeModal: () => void;
}

const ModalContext = createContext<ModalContextType | null>(null);

export const useModal = () => {
    const context = useContext(ModalContext);
    if (!context) throw new Error("useModal must be used within a ModalProvider");
    return context;

};

export const ModalProvider = ({ children }: { children: React.ReactNode }) => {
    const [modalContent, setModalContent] = useState<React.ReactNode | null>(null);
    const [modalConfig, setModalConfig] = useState<ModalConfig | null>(null);

    const showModal = useCallback((content: React.ReactNode, config?: ModalConfig) => {
        setModalContent(content);
        setModalConfig(config || null);
    }, []);

    const closeModal = useCallback(() => {
        setModalContent(null);
        setModalConfig(null);
    }, []);

    const value = useMemo(() => ({ showModal, closeModal }), [showModal, closeModal]);

    return (
        <ModalContext.Provider value={value}>
            {children}
            {modalContent && (
                <Modal onClose={closeModal} width={modalConfig?.width} maxWidth={modalConfig?.maxWidth}>
                    {modalContent}
                </Modal>
            )}
        </ModalContext.Provider>
    );
};