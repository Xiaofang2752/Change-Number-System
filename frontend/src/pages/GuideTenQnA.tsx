

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import CMImg from './DCPSop-CM.png';
import DiasorinImg from './DCPSop-Diasorin.png';
import DingTalkScanImg from './DingTalkScan.png';

export function GuideTenQnA() {
	const navigate = useNavigate();
	const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
	const [lightboxAlt, setLightboxAlt] = useState<string>('');

	const openLightbox = (src: string, alt: string) => {
		setLightboxSrc(src);
		setLightboxAlt(alt);
	};

	const closeLightbox = () => {
		setLightboxSrc(null);
	};

	const qnas = [
		{
			q: '第1次走DCP-CR-CN，应该如何操作？',
			a: (
				<>
					<p>请先确认所属项目：</p>
					<ul className="list-disc ml-5">
						<li>若属于国内外通用项目，请按照【通用版】操作指南执行；</li>
						<li>若属于 WBDL / DSH 项目，请按照【Diasorin版】操作指南执行。</li>
					</ul>
					
					<button type="button" onClick={() => openLightbox(CMImg, 'DCP SOP CM')} className="mt-2 w-full text-left rounded-md border p-0">
						<img src={CMImg} alt="DCP SOP CM" className="w-full object-contain rounded-md" />
					</button>

					<button type="button" onClick={() => openLightbox(DiasorinImg, 'DCP SOP Diasorin')} className="mt-2 w-full text-left rounded-md border p-0">
						<img src={DiasorinImg} alt="DCP SOP Diasorin" className="w-full object-contain rounded-md" />
					</button>
				</>
			),
		},
		{
			q: 'QBC-AT 应用软件由客户维护，由客户提供软件包，此类情况如何处理？',
			a: (
				<div>
					<p>按以下步骤执行：</p>
					<ol className="list-decimal ml-5">
						<li>发起【外来文件受控审批】钉钉流程；</li>
						<li>发起【TD技术文件审批受控】钉钉流程，将客户软件包+验证报告（签字版）等作为技术文件受控到服务器；</li>
						<li>发起【CN变更通知】钉钉流程，填写CI实施表作为附件。</li>
					</ol>
					<p className="mt-2">法规依据：</p>
					<ul className="list-disc ml-5">
						<li>ISO 13485:2016 4.2.4（外来文件控制）</li>
						<li>ISO 13485:2016 7.5.6（生产和服务提供过程确认）</li>
						<li>21 CFR 820.30（设计控制）</li>
					</ul>
				</div>
			),
		},
		{
			q: '现有项目风险管理文件未识别本次变更风险，应如何补充登记？',
			a: (
				<div>
					<p>请在钉钉在线文档中，找到对应项目并补充登记相关风险：</p>
					<p><a href="https://alidocs.dingtalk.com/i/nodes/m9bN7RYPWdXnZE5ptkPlRPXeWZd1wyK0?utm_scene=person_space" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">https://alidocs.dingtalk.com/i/nodes/m9bN7RYPWdXnZE5ptkPlRPXeWZd1wyK0?utm_scene=person_space</a></p>
					<p className="mt-2">注意：ODBC / WBDL / DSH 涉及文档交付物，请及时更新相关风险文档，如 FMECA 等。</p>
				</div>
			)
		},
		{
			q: 'DCP 中“成本影响”应如何填写？',
			a: (
				<div>
					<p>参考QST-MS04-01-001-R003《变更影响评估表》：</p>
					<ul className="list-disc ml-5">
						<li>若变更导致成本下降：填写“整机 BOM 成本无增加”；</li>
						<li>若成本上升：按实际金额填写（如“整机 BOM 成本增加 XX 元”）。</li>
					</ul>
				</div>
			),
		},
		{
			q: '产线仪器有通过返工单升级，那研发机又当如何记录？',
			a: (
				<div>
					<p>请填写QST-MS04-01-001-R018 《研发仪器更改确认单R&D Instrument Change Checklist》，完成记录并及时归档。</p>
					<p className="mt-2">法规依据：</p>
					<ul className="list-disc ml-5">
						<li>ISO 13485:2016 7.6（监视和测量设备控制）</li>
						<li>ISO 13485:2016 4.2.5（记录控制）</li>
					</ul>
				</div>
			),
		},
		{
			q: '所有文档升版都需要走DCP吗？',
			a: (
				<div>
					<p>分两种情况：</p>
					<ul className="list-disc ml-5">
						<li>纯文件优化（如文字修订，不影响产品规格/性能等）→ 直接走文件升版流程（拟制-审核-批准），不需要走DCP；</li>
						<li>设计变更引起的文件升版（先有设计变更，文档跟着改）→ 需要走DCP，文件作为变更的附件捆绑升版（适用于DHF、DMR文件）。</li>
					</ul>
				</div>
			),
		},
		{
			q: '变更分析的“N/A”和“无影响”如何区分？为什么写N/A会被批注？',
			a: (
				<div>
					<p>“N/A”表示不适用，但需说明理由。无理由的“N/A”无法证明是否经过充分评估，易被客户等审查质疑；</p>
					<p>“无影响”表示已完成分析后的结论。</p>
				</div>
			),
		},
		{
			q: 'DCP第5章节交付物中的SVN路径怎么写？',
			a: (
				<div>
					<p>需填写两类路径：</p>
					<ul className="list-disc ml-5">
						<li>项目组 SVN 路径：确保原始资料可继承；</li>
						<li>受控路径：用于文控归档及审核核查。</li>
					</ul>
					<p className="mt-2">法规依据：</p>
					<ul className="list-disc ml-5">
						<li>ISO 13485:2016 4.2.4（文件可追溯性与控制）</li>
						<li>21 CFR 820.180（记录可获取性）</li>
					</ul>
				</div>
			),
		},
		{
			q: '多份 DCP 存在配套变更，交付物是否需要体现？',
			a: (
				<div>
					<p>需要体现。建议：</p>
					<ul className="list-disc ml-5">
						<li>在DCP交付物表格下增加备注说明：该交付物属于配套变更，将由其他 DCP 实施；</li>
						<li>在CI实施表（C列，文件类型）中选择“延迟生效”等选项，明确不随当前 DCP 生效。</li>
					</ul>
				</div>
			),
		},
		{
			q: '钉钉流程CR 变更申请中的“共同编制人（Co-compiler）”如何选择？',
			a: (
				<div>
					<p>按实际参与变更的工程师选择：</p>
					<ul className="list-disc ml-5">
						<li>涉及哪些专业，就选择对应工程师；</li>
						<li>如机械变更影响软件，应同时选择机械、软件工程师；</li>
						<li>如交付物中涉及SOP，应同时选择工艺工程师；</li>
					</ul>
					<p className="mt-2">原则：谁参与交付物或评估，谁纳入共同编制确认。</p>
				</div>
			),
		},
	];

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

				<div className="space-y-4">
					{qnas.map((item, idx) => (
						<div key={idx} className="p-4 border rounded-md bg-white/50">
							<div className="font-semibold">{`问${idx + 1}：${item.q}`}</div>
							<div className="text-sm text-muted-foreground mt-2 leading-relaxed">{typeof item.a === 'string' ? item.a : item.a}</div>
						</div>
					))}
				</div>

				<div className="mt-6 rounded-md border bg-slate-50 p-4 text-sm text-slate-700">
					<p>如有更多问题，欢迎留言反馈，我们将持续优化并第一时间为大家解答。</p>
				<div className="mt-6 flex justify-center">
					<img src={DingTalkScanImg} alt="钉钉扫描二维码" className="w-40 h-40 object-contain" />
				</div>
			</div>

				{lightboxSrc ? (
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
				) : null}
			</div>
		</Layout>
	);
}

export default GuideTenQnA;

