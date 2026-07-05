import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Layout } from '../components/Layout';
import { Button } from '../components/ui/button';
import { guideQnaAPI } from '../services';
import type { GuideQna, GuideQnaHistory, GuideQnaHistoryDetail } from '../services';
import { formatBeijingTime } from '@/utils/timezone';

export function GuideTenQnA() {
  const navigate = useNavigate();
  const [items, setItems] = useState<GuideQna[]>([]);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState<string>('');
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState<GuideQnaHistory[]>([]);
  const [historyDetail, setHistoryDetail] = useState<GuideQnaHistoryDetail | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    loadPublished();
  }, []);

  const loadPublished = async () => {
    setLoading(true);
    try {
      const res = await guideQnaAPI.getPublished();
      const data = (res as { data: { items: GuideQna[]; published_at: string | null } }).data;
      setItems(data?.items || []);
      setPublishedAt(data?.published_at || null);
    } catch (err) {
      console.error('加载问答失败', err);
      setError('加载问答失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const openLightbox = (src: string, alt: string) => {
    setLightboxSrc(src);
    setLightboxAlt(alt);
  };

  const closeLightbox = () => {
    setLightboxSrc(null);
  };

  const loadHistoryList = async () => {
    setHistoryLoading(true);
    try {
      const res = await guideQnaAPI.getHistoryList();
      const data = (res as { data: GuideQnaHistory[] }).data;
      setHistoryList(data || []);
    } catch (err) {
      console.error('加载历史版本失败', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleViewHistory = async (id: number) => {
    try {
      const res = await guideQnaAPI.getHistoryDetail(id);
      const data = (res as { data: GuideQnaHistoryDetail }).data;
      setHistoryDetail(data);
    } catch (err) {
      console.error('加载历史详情失败', err);
      alert('加载失败');
    }
  };

  const handleToggleHistory = () => {
    if (!showHistory && historyList.length === 0) {
      loadHistoryList();
    }
    setShowHistory(!showHistory);
    setHistoryDetail(null);
  };

  const markdownComponents: Components = {
    img: ({ src, alt, ...props }) => {
      const imageSrc = typeof src === 'string' ? src : '';
      const imageAlt = alt || '';

      return (
        <img
          src={imageSrc}
          alt={imageAlt}
          className="w-full object-contain rounded-md cursor-zoom-in"
          onClick={() => imageSrc && openLightbox(imageSrc, imageAlt)}
          {...props}
        />
      );
    },
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border-2 border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 hover:border-slate-400 active:bg-slate-100 transition-all duration-200 shadow-sm hover:shadow-lg hover:scale-105 whitespace-nowrap"
            title="返回上一页"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            <span>返回</span>
          </button>
          <h2 className="text-2xl font-bold">变更实操 Q&A（10问10答）</h2>
        </div>

        {publishedAt && (
          <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-slate-500">
              最近更新时间：<span className="font-semibold text-slate-700">{formatBeijingTime(publishedAt)}</span>
            </p>
            <Button variant="outline" size="sm" onClick={handleToggleHistory} className="text-xs">
              {showHistory ? '收起历史版本' : '查看历史版本'}
            </Button>
          </div>
        )}

        {showHistory && (
          <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-bold text-slate-700 mb-3">历史版本列表</h3>
            {historyLoading ? (
              <p className="text-xs text-muted-foreground">加载中...</p>
            ) : historyList.length === 0 ? (
              <p className="text-xs text-muted-foreground">暂无历史版本</p>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                  {historyList.map(h => (
                    <button
                      key={h.id}
                      onClick={() => handleViewHistory(h.id)}
                      className={`text-left p-2.5 rounded-md border text-xs transition ${historyDetail?.id === h.id ? 'border-sky-400 bg-sky-50' : 'border-slate-200 bg-white hover:border-sky-300'}`}
                    >
                      <div className="font-semibold text-slate-700">{h.version_label}</div>
                      <div className="text-slate-500 mt-0.5">{formatBeijingTime(h.published_at)} · {h.content_hash_short}</div>
                    </button>
                  ))}
                </div>
                {historyDetail && (
                  <div className="border-t border-slate-200 pt-3 mt-3">
                    <h4 className="text-xs font-bold text-slate-700 mb-2">{historyDetail.version_label} 内容预览</h4>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {historyDetail.items.map((item, idx) => (
                        <div key={idx} className="p-3 border rounded-md bg-white">
                          <div className="font-semibold text-sm">{`问${idx + 1}：${item.question}`}</div>
                          <div className="text-sm text-muted-foreground mt-2 prose prose-sm max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.answer}</ReactMarkdown>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {error && (
          <div className="p-4 border border-red-200 bg-red-50 text-red-800 rounded-md mb-4">{error}</div>
        )}

        {loading ? (
          <div className="text-center py-10 text-muted-foreground">加载中...</div>
        ) : (
          <div className="space-y-4">
            {items.map((item, idx) => (
              <div key={item.id || idx} className="p-4 border rounded-md bg-white/50">
                <div className="font-semibold">{`问${idx + 1}：${item.question}`}</div>
                <div className="text-sm text-muted-foreground mt-2 leading-relaxed prose prose-sm max-w-none prose-img:rounded-md prose-img:cursor-zoom-in prose-a:text-blue-600 prose-a:underline">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents}
                  >
                    {item.answer}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 rounded-md border bg-slate-50 p-4 text-sm text-slate-700">
          <p>如有更多问题，欢迎留言反馈，我们将持续优化并第一时间为大家解答。</p>
          <div className="mt-6 flex justify-center">
            <img src="/images/guide/DingTalkScan.png" alt="钉钉扫描二维码" className="w-40 h-40 object-contain" />
          </div>
        </div>

        {lightboxSrc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={closeLightbox}>
            <div className="relative max-h-full w-full max-w-5xl overflow-auto" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={closeLightbox}
                className="absolute right-2 top-2 rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-slate-900"
              >
                关闭
              </button>
              <img src={lightboxSrc} alt={lightboxAlt} className="w-full max-h-[80vh] object-contain rounded-md" />
              <p className="mt-3 text-center text-white">{lightboxAlt}</p>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default GuideTenQnA;
