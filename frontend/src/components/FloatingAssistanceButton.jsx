import { MessageSquare } from 'lucide-react';

export default function FloatingAssistanceButton() {
  return (
    <a 
      href="https://wa.me/254757426058?text=Hello!%20I%20need%20assistance%20with%20the%20House%20Hunting%20Platform."
      target="_blank" 
      rel="noopener noreferrer" 
      className="fixed bottom-6 right-6 bg-emerald-500 hover:bg-emerald-600 text-white p-4 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 group z-50"
    >
      <MessageSquare className="h-6 w-6" />
      <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-out font-medium text-sm whitespace-nowrap ml-0 group-hover:ml-2">
        Chat Assistance
      </span>
    </a>
  );
}