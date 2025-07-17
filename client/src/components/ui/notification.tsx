import * as React from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export interface NotificationProps {
  id: string;
  title: string;
  description?: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  onClose?: (id: string) => void;
}

const typeStyles = {
  success: "bg-green-600 border-green-500",
  error: "bg-red-600 border-red-500",
  warning: "bg-yellow-600 border-yellow-500",
  info: "bg-blue-600 border-blue-500",
};

const typeIcons = {
  success: "✓",
  error: "✕",
  warning: "⚠",
  info: "ℹ",
};

export const Notification: React.FC<NotificationProps> = ({
  id,
  title,
  description,
  type = 'info',
  duration = 5000,
  onClose,
}) => {
  const [isVisible, setIsVisible] = React.useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onClose?.(id), 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [id, duration, onClose]);

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        "fixed top-4 right-4 z-50 max-w-sm w-full rounded-lg border p-4 shadow-lg transition-all duration-300",
        typeStyles[type],
        "notification animate-in slide-in-from-right"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <div className="w-6 h-6 bg-white bg-opacity-20 rounded-full flex items-center justify-center text-white text-sm font-bold">
              {typeIcons[type]}
            </div>
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-medium text-white">{title}</h4>
            {description && (
              <p className="text-sm text-white text-opacity-90 mt-1">{description}</p>
            )}
          </div>
        </div>
        <button
          onClick={() => {
            setIsVisible(false);
            setTimeout(() => onClose?.(id), 300);
          }}
          className="flex-shrink-0 text-white text-opacity-70 hover:text-opacity-100 transition-opacity"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export interface NotificationProviderProps {
  children: React.ReactNode;
}

export interface NotificationContextType {
  showNotification: (notification: Omit<NotificationProps, 'id'>) => void;
}

const NotificationContext = React.createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = React.useState<NotificationProps[]>([]);

  const showNotification = React.useCallback((notification: Omit<NotificationProps, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setNotifications(prev => [...prev, { ...notification, id }]);
  }, []);

  const removeNotification = React.useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.map(notification => (
          <Notification
            key={notification.id}
            {...notification}
            onClose={removeNotification}
          />
        ))}
      </div>
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = React.useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
