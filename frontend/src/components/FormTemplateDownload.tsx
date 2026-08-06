import { useState, useEffect } from 'react';
import { dcpAPI } from '../services';
import { Download, FileText, FileSpreadsheet } from 'lucide-react';

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
 * “表单模板下载”板块：工程师直接下载最新空白表单模板（不填编号，占位符保留）。
 * 后台可维护模板内容与名称，下载文件名取后台名称。
 */
export function FormTemplateDownload() {
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
            return {
              ...f,
              exists: !!data?.exists,
              display_name: data?.display_name || null,
              ext,
            } as TplInfo;
          })
          .catch(() => ({ ...f, exists: false } as TplInfo))
      )
    ).then((results) => {
      if (!cancelled) setList(results);
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-slate-50 via-slate-100/50 to-slate-50 border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            表单模板下载
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            下载最新空白表单模板（含占位符，请工程师手动填写）。后台维护，版本随发布更新。
          </p>
        </div>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="text-center py-6 text-sm text-slate-500">加载模板列表...</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((item) => {
              const name = item.display_name || item.defaultLabel;
              const isXlsx = item.ext === 'xlsx';
              return (
                <div
                  key={item.type}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 hover:border-primary/50 hover:shadow-sm transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isXlsx ? (
                      <FileSpreadsheet className="h-5 w-5 text-emerald-600 shrink-0" />
                    ) : (
                      <FileText className="h-5 w-5 text-sky-600 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate" title={name}>{name}</p>
                      <p className="text-[11px] text-slate-400">
                        {item.type}{item.exists ? ` · ${item.ext?.toUpperCase()}` : ' · 未上传'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!item.exists}
                    onClick={() => dcpAPI.downloadTemplateFile(item.type)}
                    className={`shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      item.exists
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Download className="h-3.5 w-3.5" />
                    下载
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
