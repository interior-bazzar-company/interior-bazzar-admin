import { useCallback } from "react";
import { useModal } from "../../../context/ModalContext";
import type { ToastPropType } from "../../../types/propTypes";
import Toast from "./Toast";

const useToast = () => {
    const { showModal } = useModal();
    const showToast = useCallback((config: ToastPropType) => {
        showModal(<Toast config={config} />);
    }, [showModal]);
    return { showToast };
}
export default useToast;