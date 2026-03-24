import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import Modal from "../../components/overlays/Modal";

// Define types for the context values
interface ModalContextType {
    showModal: (content: React.ReactNode) => void;
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

    const showModal = useCallback((content: React.ReactNode) => {
        setModalContent(content);
    }, []);

    const closeModal = useCallback(() => {
        setModalContent(null);
    }, []);

    const value = useMemo(() => ({ showModal, closeModal }), [showModal, closeModal]);

    return (
        <ModalContext.Provider value={value}>
            {children}
            {modalContent && (
                <Modal onClose={closeModal}>
                    {modalContent}
                </Modal>
            )}
        </ModalContext.Provider>
    );
};