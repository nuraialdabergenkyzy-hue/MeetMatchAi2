import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
const Toast = createContext<(text: string) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [text, setText] = useState(""),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <Toast.Provider
      value={(text) => {
        clearTimeout(timer.current);
        setText(text);
        timer.current = setTimeout(() => setText(""), 4500);
      }}
    >
      {children}
      <div role="status" aria-live="polite" className={text ? "toast" : ""}>
        {text}
      </div>
    </Toast.Provider>
  );
}
export const useToast = () => useContext(Toast);
