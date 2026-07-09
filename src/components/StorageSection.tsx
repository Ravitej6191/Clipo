import { Cloud } from 'lucide-react';
import { useNotes } from '../contexts/NoteContext';

const FREE_LIMIT = 5 * 1024 ** 3; // Firebase Storage free tier: 5 GB

function formatBytes(b: number): string {
  if (b < 1024)       return `${b} B`;
  if (b < 1024 ** 2)  return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3)  return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

export default function StorageSection() {
  const { notes } = useNotes();

  const usedBytes = notes.reduce((sum, n) =>
    sum + (n.attachments ?? []).reduce((s, a) => s + (a.fileSizeBytes ?? 0), 0), 0);
  const fileCount = notes.reduce((sum, n) =>
    sum + (n.attachments ?? []).filter(a => a.fileSizeBytes).length, 0);

  const pct = Math.min((usedBytes / FREE_LIMIT) * 100, 100);
  const barColor = pct > 90 ? 'bg-red-400' : pct > 70 ? 'bg-orange-400' : 'bg-[#7C3AED]/60';

  return (
    <div className="px-4 py-3 border-t border-gray-100">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <Cloud size={12} className="text-[#7C3AED]" />
          <span className="text-[11px] font-semibold text-[#374151]">Storage</span>
        </div>
        <span className="text-[10px] text-[#9CA3AF]">
          {fileCount} file{fileCount !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden mb-1.5">
        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }} />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-[#111827]">{formatBytes(usedBytes)}</span>
        <span className="text-[10px] text-[#9CA3AF]">of {formatBytes(FREE_LIMIT)} free</span>
      </div>
    </div>
  );
}
