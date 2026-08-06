import { useState, useEffect } from 'react';
import { dcpAPI } from '../services';
import { Download, FileText, FileSpreadsheet, ChevronDown, Sparkles } from 'lucide-react';

type DocTemplateType = 'DCP' | 'IMPACT' | 'RISK' | 'VERIFY' | 'IMPLEMENT';

interface TplInfo {
  type: DocTemplateType;
  defaultLabel: string;
  exists: boolean;
  display_name?: string | null;
  ext?: 'docx' | 'xlsx';
}

const FORM_TYPES: { type: DocTemplateType; defaultLabel: string }[] = [
  { type: 'DCP', defaultLabel: '设计变更方案' },
  { type: 'IMPACT', defaultLabel: '变更影响评估表' },
  { type: 'RISK', defaultLabel: '风险登记册' },
  { type: 'VERIFY', defaultLabel: '验证模板' },
  { type: 'IMPLEMENT', defaultLabel: '变更实施表' },
];

/**
 * “表单模板下载”板块（可折叠）：放右侧十问十答下方。
 * 工程师点开后可下载最新空白表单模板（不填编号，占位符保留）。
 */
export function FormTemplateDownload() {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<TplInfo[]>(
    FORM_TYPES.map((f) => ({ ...f, exists: false }))
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      FORM_TYPES.map((f) =>
        dcpAPI
          .getTemplateMeta(f.type)
          .then((res) => {
            const data = (res as unknown as { data?: { exists?: boolean; display_name?: string | null; filename?: string } }).data;
            const ext: 'docx' | 'xlsx' | undefined = data?.filename
              ? (data.filename.toLowerCase().endsWith('.xlsx') ? 'xlsx' : 'docx')
              : undefined;
            return { ...f, exists: !!data?.exists, display_name: data?.display_name || null, ext } as TplInfo;
          })
          .catch(() => ({ ...f, exists: false } as TplInfo))
      )
    ).then((results) => {
      if (!cancelled) {
        setList(results);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const readyCount = list.filter((i) => i.exists).length;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* 可点击的标题栏 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3.5 py-3 text-left hover:bg-slate-50 transition-colors"
      >
        <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="text-sm font-bold text-slate-800 flex-1">表单模板下载</span>
        {/* 闪亮标识 */}
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black text-white bg-gradient-to-r from-amber-400 to-orange-500 shadow-[0_0_10px_rgba(251,146,60,0.65)] animate-pulse">
          {readyCount > 0 ? `${readyCount} 个可下` : 'NEW'}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* 折叠内容 */}
      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-slate-100">
          <p className="text-[11px] text-muted-foreground mb-2 leading-relaxed">
            点击下载最新空白模板（含占位符，请手动填写）。后台维护，版本随发布更新。
          </p>
          {loading ? (
            <div className="text-center py-4 text-xs text-slate-400">加载中...</div>
          ) : (
            <div className="space-y-1.5">
              {list.map((item) => {
                const name = item.display_name || item.defaultLabel;
                const isXlsx = item.ext === 'xlsx';
                return (
                  <div
                    key={item.type}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 hover:border-primary/50 transition"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isXlsx ? (
                        <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
                      ) : (
                        <FileText className="h-4 w-4 text-sky-600 shrink-0" />
                      )}
                      <span className="text-xs font-medium text-slate-700 truncate" title={name}>{name}</span>
                    </div>
                    <button
                      type="button"
                      disabled={!item.exists}
                      onClick={() => dcpAPI.downloadTemplateFile(item.type)}
                      className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                        item.exists
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <Download className="h-3 w-3" />
                      下载
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
