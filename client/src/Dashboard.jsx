import { useState } from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from "recharts";

const COLOR_PALETTE = ["#6366F1", "#22D3EE", "#FB7185", "#F97316", "#A855F7", "#0EA5E9", "#10B981", "#F59E0B"];
const PIE_COLORS = ["#6366F1", "#22D3EE", "#FB7185", "#F97316", "#A855F7", "#10B981", "#F59E0B", "#14B8A6"];

const getColor = (index) => COLOR_PALETTE[index % COLOR_PALETTE.length];

const formatNumberValue = (value, fractionDigits, numberFormatter) => {
	if (typeof value !== "number" || Number.isNaN(value)) {
		return fractionDigits ? "0.0" : "0";
	}
	if (fractionDigits) {
		return value.toLocaleString("vi-VN", {
			minimumFractionDigits: fractionDigits,
			maximumFractionDigits: fractionDigits
		});
	}
	return numberFormatter.format(value);
};

const truncate = (text, length = 140) => {
	if (!text) return "";
	const trimmed = text.trim();
	return trimmed.length > length ? `${trimmed.slice(0, length)}…` : trimmed;
};

const SAMPLE_ANALYTICS = {
	summary: {
		totalSessions: 42,
		activeSessions24h: 8,
		userMessages: 278,
		assistantMessages: 312,
		averageMessagesPerSession: 14.1,
		uniqueLearners: 18,
		attachmentsUploaded: 27,
		sessionsWithAttachments: 12,
		firstMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 21).toISOString(),
		lastMessageAt: new Date().toISOString()
	},
	usage: {
		hourly: [
			{ hour: 0, count: 3 },
			{ hour: 1, count: 2 },
			{ hour: 2, count: 1 },
			{ hour: 3, count: 1 },
			{ hour: 4, count: 1 },
			{ hour: 5, count: 2 },
			{ hour: 6, count: 4 },
			{ hour: 7, count: 6 },
			{ hour: 8, count: 9 },
			{ hour: 9, count: 11 },
			{ hour: 10, count: 12 },
			{ hour: 11, count: 10 },
			{ hour: 12, count: 8 },
			{ hour: 13, count: 9 },
			{ hour: 14, count: 13 },
			{ hour: 15, count: 15 },
			{ hour: 16, count: 14 },
			{ hour: 17, count: 12 },
			{ hour: 18, count: 11 },
			{ hour: 19, count: 9 },
			{ hour: 20, count: 18 },
			{ hour: 21, count: 14 },
			{ hour: 22, count: 10 },
			{ hour: 23, count: 6 }
		],
		weekly: [
			{ day: "Thứ 2", count: 34 },
			{ day: "Thứ 3", count: 28 },
			{ day: "Thứ 4", count: 22 },
			{ day: "Thứ 5", count: 19 },
			{ day: "Thứ 6", count: 41 },
			{ day: "Thứ 7", count: 24 },
			{ day: "Chủ nhật", count: 16 }
		],
		daily: Array.from({ length: 14 }, (_, index) => {
			const date = new Date();
			date.setDate(date.getDate() - (13 - index));
			return {
				date: date.toISOString().slice(0, 10),
				label: date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }),
				count: Math.floor(10 + Math.sin(index / 2) * 6 + (index % 3) * 3)
			};
		})
	},
	topics: {
		guides: [
			{ title: "Buổi 04 - Giao thông an toàn", count: 21 },
			{ title: "Buổi 07 - Đại chiến không trung", count: 18 },
			{ title: "Buổi 10 - Dự án phần 1", count: 16 },
			{ title: "Workshop kỹ năng", count: 14 },
			{ title: "Buổi 02 - Thiệp mừng", count: 12 }
		],
		keywords: [
			{ keyword: "Scratch", count: 38 },
			{ keyword: "animation", count: 24 },
			{ keyword: "game", count: 22 },
			{ keyword: "loop", count: 19 },
			{ keyword: "score", count: 15 },
			{ keyword: "broadcast", count: 14 },
			{ keyword: "sprite", count: 13 },
			{ keyword: "collision", count: 11 }
		]
	},
	audience: {
		programs: [
			{ label: "SB", count: 22 },
			{ label: "SA", count: 12 },
			{ label: "SI", count: 8 }
		],
		grades: [
			{ label: "Lớp 3", count: 6 },
			{ label: "Lớp 4", count: 8 },
			{ label: "Lớp 5", count: 11 },
			{ label: "Lớp 6", count: 10 },
			{ label: "Lớp 7", count: 7 }
		],
		goals: [
			{ label: "Hoàn thiện dự án cuối khóa", count: 12 },
			{ label: "Ôn luyện kiến thức Scratch", count: 9 },
			{ label: "Chuẩn bị thi MindX Challenge", count: 6 }
		],
		favoriteTopics: [
			{ label: "Game bắn máy bay", count: 10 },
			{ label: "Robot", count: 8 },
			{ label: "Toán vui", count: 7 },
			{ label: "Âm nhạc", count: 5 }
		],
		preferences: {
			tone: [
				{ label: "coach", count: 18 },
				{ label: "enthusiastic", count: 12 },
				{ label: "concise", count: 7 }
			],
			detail: [
				{ label: "balanced", count: 20 },
				{ label: "deep", count: 10 },
				{ label: "concise", count: 6 }
			],
			includeScratchSteps: { true: 30, false: 5 },
			includePracticeIdeas: { true: 28, false: 7 }
		}
	},
	sessions: {
		recent: [
			{
				id: "session-1",
				displayTitle: "Buổi 07 - Điều khiển máy bay",
				title: "Buổi 07 - Điều khiển máy bay",
				createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
				lastActiveAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
				totalMessages: 18,
				userMessages: 9,
				assistantMessages: 9,
				topTopics: ["Buổi 07", "Game chiến đấu", "Scratch"]
			},
			{
				id: "session-2",
				displayTitle: "Dự án cuối khóa - ý tưởng",
				title: "Dự án cuối khóa - ý tưởng",
				createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6).toISOString(),
				lastActiveAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
				totalMessages: 22,
				userMessages: 11,
				assistantMessages: 11,
				topTopics: ["Dự án", "Thuyết trình"]
			},
			{
				id: "session-3",
				displayTitle: "Workshop kỹ năng",
				title: "Workshop kỹ năng",
				createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
				lastActiveAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
				totalMessages: 12,
				userMessages: 6,
				assistantMessages: 6,
				topTopics: ["Workshop", "Teamwork"]
			}
		]
	},
	messages: {
		recent: [
			{
				timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
				sessionId: "session-1",
				role: "user",
				content: "Cô ơi máy bay của em không bay khi nhấn phím cách, phải làm sao?",
				references: ["Buổi 07 - Đại chiến không trung"]
			},
			{
				timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
				sessionId: "session-1",
				role: "assistant",
				content: "Em thêm khối `Events > When Space Key Pressed` và lồng khối `Control > Repeat 10` để máy bay bay mượt hơn nhé!",
				references: ["Buổi 07 - Đại chiến không trung"]
			},
			{
				timestamp: new Date(Date.now() - 1000 * 60 * 50).toISOString(),
				sessionId: "session-2",
				role: "assistant",
				content: "Cô gợi ý em chia bài thuyết trình thành 3 phần: Giới thiệu, Cách làm và Bài học rút ra với mỗi phần 2 slide.",
				references: ["Buổi 14 - Thuyết trình cuối khóa"]
			}
		]
	},
	generatedAt: new Date().toISOString()
};

export default function Dashboard({
	isAdminAuthenticated,
	adminLoginError,
	adminLoginPending,
	adminUsername,
	adminPassword,
	onAdminUsernameChange,
	onAdminPasswordChange,
	onLogin,
	onReturnToChat,
	analyticsData,
	analyticsLoading,
	analyticsError,
	analyticsLastUpdated,
	onRefresh,
	onLogout,
	numberFormatter,
	dateTimeFormatter,
	shortDateFormatter
}) {
	const [showDemo, setShowDemo] = useState(() => !isAdminAuthenticated);
	const isDemoMode = showDemo && !isAdminAuthenticated;
	const allowDashboard = isAdminAuthenticated || isDemoMode;

	if (!allowDashboard) {
		return (
			<div className="admin-login">
				<div className="admin-login-card">
					<h2>🔐 Đăng nhập quản trị</h2>
					<p>Nhập tài khoản admin để xem báo cáo tổng quan hệ thống.</p>
					<p className="admin-login-hint">Tài khoản mặc định: <strong>admin</strong> • Mật khẩu: <strong>Mindx@2024</strong></p>
					{adminLoginError && <div className="error admin-error">{adminLoginError}</div>}
					<form className="admin-login-form" onSubmit={onLogin}>
						<label htmlFor="admin-username">Tài khoản</label>
						<input
							id="admin-username"
							type="text"
							value={adminUsername}
							onChange={(event) => onAdminUsernameChange(event.target.value)}
							autoComplete="username"
							disabled={adminLoginPending}
						/>
						<label htmlFor="admin-password">Mật khẩu</label>
						<input
							id="admin-password"
							type="password"
							value={adminPassword}
							onChange={(event) => onAdminPasswordChange(event.target.value)}
							autoComplete="current-password"
							disabled={adminLoginPending}
						/>
						<button type="submit" disabled={adminLoginPending}>
							{adminLoginPending ? "Đang đăng nhập..." : "Đăng nhập"}
						</button>
					</form>
						<button
							type="button"
							className="toolbar-button"
							onClick={() => setShowDemo(true)}
						>
							🌟 Xem thử dữ liệu demo
						</button>
					<button type="button" className="toolbar-button subtle" onClick={onReturnToChat}>
						⬅️ Quay lại chat
					</button>
				</div>
			</div>
		);
	}

	const hasRealData = Boolean(analyticsData) && !isDemoMode;
	const dataSource = hasRealData ? analyticsData : SAMPLE_ANALYTICS;

	const summary = dataSource?.summary ?? {};
	const usage = dataSource?.usage ?? {};
	const topics = dataSource?.topics ?? {};
	const audience = dataSource?.audience ?? {};
	const sessionsInfo = dataSource?.sessions ?? {};
	const messagesInfo = dataSource?.messages ?? {};

	const hourlyData = Array.isArray(usage.hourly) ? usage.hourly : [];
	const weeklyData = Array.isArray(usage.weekly) ? usage.weekly : [];
	const dailyData = Array.isArray(usage.daily) ? usage.daily : [];

	const hourlyChartData = hourlyData.map((item) => ({
		hourLabel: `${String(item.hour ?? item.label ?? 0).padStart(2, "0")}h`,
		count: item.count ?? item.value ?? 0
	}));

	const weeklyChartData = weeklyData.map((item, index) => ({
		dayLabel: item.day ?? item.label ?? `Thứ ${index + 2}`,
		count: item.count ?? item.value ?? 0
	}));

	const dailyChartData = dailyData.map((item) => ({
		dateKey: item.date ?? item.label,
		label: item.label
			? item.label
			: item.date
			? shortDateFormatter.format(new Date(item.date))
			: "",
		count: item.count ?? item.value ?? 0
	}));

	const keywordChartData = (topics.keywords ?? []).slice(0, 10).map((item, index) => ({
		name: item.keyword,
		value: item.count ?? item.value ?? 0,
		color: getColor(index)
	}));

	const gradeChartData = (audience.grades ?? []).map((item, index) => ({
		name: item.label,
		value: item.count ?? item.value ?? 0,
		color: getColor(index)
	}));

	const goalList = audience.goals ?? [];
	const favoriteTopicsList = audience.favoriteTopics ?? [];
	const programList = audience.programs ?? [];

	const toneDistribution = Array.isArray(audience.preferences?.tone) ? audience.preferences.tone : [];
	const detailDistribution = Array.isArray(audience.preferences?.detail) ? audience.preferences.detail : [];
	const includeScratchSteps = audience.preferences?.includeScratchSteps ?? { true: 0, false: 0 };
	const includePracticeIdeas = audience.preferences?.includePracticeIdeas ?? { true: 0, false: 0 };

	const toneChartData = toneDistribution.map((item, index) => ({
		name: item.label,
		value: item.count ?? item.value ?? 0,
		color: PIE_COLORS[index % PIE_COLORS.length]
	}));

	const detailChartData = detailDistribution.map((item, index) => ({
		name: item.label,
		value: item.count ?? item.value ?? 0,
		color: PIE_COLORS[(index + 2) % PIE_COLORS.length]
	}));

	const includeScratchChart = [
		{ name: "Có", value: includeScratchSteps.true ?? 0, color: PIE_COLORS[0] },
		{ name: "Không", value: includeScratchSteps.false ?? 0, color: PIE_COLORS[4] }
	];

	const includePracticeChart = [
		{ name: "Có", value: includePracticeIdeas.true ?? 0, color: PIE_COLORS[1] },
		{ name: "Không", value: includePracticeIdeas.false ?? 0, color: PIE_COLORS[5] }
	];

	const summaryCards = [
		{ label: "Tổng số phiên", value: summary.totalSessions },
		{ label: "Phiên hoạt động 24h", value: summary.activeSessions24h },
		{ label: "Tin nhắn của học sinh", value: summary.userMessages },
		{ label: "Tin nhắn của cô MindX", value: summary.assistantMessages },
		{ label: "Tin nhắn trung bình / phiên", value: summary.averageMessagesPerSession, fractionDigits: 1 },
		{ label: "Hồ sơ học sinh ghi nhận", value: summary.uniqueLearners },
		{ label: "Tệp đính kèm đã xử lý", value: summary.attachmentsUploaded },
		{ label: "Phiên có tệp đính kèm", value: summary.sessionsWithAttachments }
	];

	const generatedAtLabel = dataSource?.generatedAt
		? dateTimeFormatter.format(new Date(dataSource.generatedAt))
		: null;
	const timeframeLabel =
		summary.firstMessageAt && summary.lastMessageAt
			? `${dateTimeFormatter.format(new Date(summary.firstMessageAt))} — ${dateTimeFormatter.format(
					new Date(summary.lastMessageAt)
				)}`
			: null;

	return (
		<div className="admin-dashboard">
			<div className="admin-dashboard-header">
				<div className="admin-dashboard-title">
					<h2>📊 Dashboard quản trị{isDemoMode ? " (Demo)" : ""}</h2>
					<p>
						Quan sát hành vi học tập và xu hướng câu hỏi của học sinh MindX.
						{isDemoMode && " Đây là dữ liệu minh họa để bạn tham khảo giao diện."}
					</p>
					<div className="admin-dashboard-meta">
						{generatedAtLabel && <span>Cập nhật lúc {generatedAtLabel}</span>}
						{analyticsLastUpdated && <span>Làm mới {dateTimeFormatter.format(new Date(analyticsLastUpdated))}</span>}
					</div>
				</div>
				<div className="admin-dashboard-actions">
					<button type="button" className="toolbar-button subtle" onClick={onReturnToChat}>
						⬅️ Quay lại chat
					</button>
					<button type="button" className="toolbar-button" onClick={() => onRefresh()} disabled={analyticsLoading || isDemoMode}>
						{analyticsLoading ? "Đang tải..." : isDemoMode ? "Không khả dụng trong demo" : "🔄 Làm mới"}
					</button>
					<button
						type="button"
						className="toolbar-button danger"
						onClick={isDemoMode ? () => setShowDemo(false) : onLogout}
					>
						{isDemoMode ? "🚪 Thoát demo" : "🚪 Đăng xuất"}
					</button>
				</div>
			</div>

			{(!hasRealData || isDemoMode) && !analyticsLoading && (
				<div className="admin-sample-banner">
					<span role="img" aria-hidden="true">✨</span>
					<span>
						{isDemoMode
							? "Đang xem ở chế độ demo. Khi đăng nhập quản trị thành công, dữ liệu thật sẽ hiển thị."
							: "Đang hiển thị dữ liệu minh họa. Khi có cuộc trò chuyện thật, bảng điều khiển sẽ tự động cập nhật số liệu."}
					</span>
				</div>
			)}

			{analyticsError && <div className="error admin-error">{analyticsError}</div>}

			{analyticsLoading && !hasRealData && !isDemoMode ? (
				<div className="admin-loading">Đang tải dữ liệu thống kê...</div>
			) : dataSource ? (
				<>
					<section className="admin-section">
						<h3>Tổng quan hoạt động</h3>
						<div className="admin-summary-grid">
							{summaryCards.map((card) => (
								<div key={card.label} className="admin-summary-card">
									<span className="label">{card.label}</span>
									<strong>
										{card.fractionDigits
											? formatNumberValue(card.value, card.fractionDigits, numberFormatter)
											: formatNumberValue(card.value, 0, numberFormatter)}
									</strong>
								</div>
							))}
						</div>
						{timeframeLabel && <p className="admin-range">Dữ liệu từ {timeframeLabel}</p>}
					</section>

					<section className="admin-section">
						<h3>Thời gian học tập nổi bật</h3>
						<div className="admin-grid">
							<div className="admin-chart-card">
								<h4>Phân bổ theo giờ</h4>
								{hourlyChartData.length > 0 ? (
									<div className="chart-container">
										<ResponsiveContainer width="100%" height="100%">
											<BarChart data={hourlyChartData}>
												<CartesianGrid strokeDasharray="3 3" stroke="rgba(30, 41, 59, 0.12)" />
												<XAxis dataKey="hourLabel" stroke="#475569" />
												<YAxis stroke="#475569" allowDecimals={false} tickFormatter={(value) => numberFormatter.format(value)} />
												<Tooltip formatter={(value) => numberFormatter.format(value ?? 0)} labelFormatter={(label) => `Khung giờ ${label}`} />
												<Bar dataKey="count" radius={[6, 6, 0, 0]} fill="#6366F1" />
											</BarChart>
										</ResponsiveContainer>
									</div>
								) : (
									<p className="admin-empty">Chưa có dữ liệu theo giờ.</p>
								)}
							</div>
							<div className="admin-chart-card">
								<h4>Phân bổ theo ngày</h4>
								{weeklyChartData.length > 0 ? (
									<div className="chart-container">
										<ResponsiveContainer width="100%" height="100%">
											<BarChart data={weeklyChartData}>
												<CartesianGrid strokeDasharray="3 3" stroke="rgba(30, 41, 59, 0.12)" />
												<XAxis dataKey="dayLabel" stroke="#475569" />
												<YAxis stroke="#475569" allowDecimals={false} tickFormatter={(value) => numberFormatter.format(value)} />
												<Tooltip formatter={(value) => numberFormatter.format(value ?? 0)} />
												<Bar dataKey="count" radius={[6, 6, 0, 0]} fill="#22D3EE" />
											</BarChart>
										</ResponsiveContainer>
									</div>
								) : (
									<p className="admin-empty">Chưa có dữ liệu theo ngày.</p>
								)}
							</div>
						</div>
						<div className="admin-chart-card">
							<h4>14 ngày gần nhất</h4>
							{dailyChartData.length > 0 ? (
								<div className="chart-container chart-container--tall">
									<ResponsiveContainer width="100%" height="100%">
										<LineChart data={dailyChartData}>
											<CartesianGrid strokeDasharray="3 3" stroke="rgba(30, 41, 59, 0.12)" />
											<XAxis dataKey="label" stroke="#475569" interval={dailyChartData.length > 8 ? 1 : 0} />
											<YAxis stroke="#475569" allowDecimals={false} tickFormatter={(value) => numberFormatter.format(value)} />
											<Tooltip formatter={(value) => numberFormatter.format(value ?? 0)} labelFormatter={(label) => `Ngày ${label}`} />
											<Line type="monotone" dataKey="count" stroke="#F97316" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
										</LineChart>
									</ResponsiveContainer>
								</div>
							) : (
								<p className="admin-empty">Chưa có dữ liệu trong 14 ngày.</p>
							)}
						</div>
					</section>

					<section className="admin-section">
						<h3>Chủ đề & tài liệu được quan tâm</h3>
						<div className="admin-grid">
							<div className="admin-card">
								<h4>Giáo án / tài liệu</h4>
								<ul className="admin-pill-list">
									{(topics.guides ?? []).slice(0, 10).map((item) => (
										<li key={`guide-${item.title}`}>
											<span className="pill-label">{item.title}</span>
											<span className="pill-count">{numberFormatter.format(item.count ?? 0)}</span>
										</li>
									))}
								</ul>
							</div>
							<div className="admin-chart-card">
								<h4>Từ khóa nổi bật</h4>
								{keywordChartData.length > 0 ? (
									<div className="chart-container chart-container--medium">
										<ResponsiveContainer width="100%" height="100%">
											<BarChart data={keywordChartData} layout="vertical">
												<CartesianGrid strokeDasharray="3 3" stroke="rgba(30, 41, 59, 0.12)" />
												<XAxis type="number" stroke="#475569" tickFormatter={(value) => numberFormatter.format(value)} />
												<YAxis dataKey="name" type="category" stroke="#475569" width={160} />
												<Tooltip formatter={(value) => numberFormatter.format(value ?? 0)} />
												<Bar dataKey="value" radius={[0, 12, 12, 0]}>
													{keywordChartData.map((entry, index) => (
														<Cell key={`keyword-cell-${entry.name}`} fill={entry.color} />
													))}
												</Bar>
											</BarChart>
									</ResponsiveContainer>
									</div>
								) : (
									<p className="admin-empty">Chưa có dữ liệu từ khóa.</p>
								)}
							</div>
						</div>
					</section>

					<section className="admin-section">
						<h3>Hồ sơ học sinh & cấu hình trả lời</h3>
						<div className="admin-grid">
							<div className="admin-chart-card">
								<h4>Phân bố lớp / độ tuổi</h4>
								{gradeChartData.length > 0 ? (
									<div className="chart-container">
										<ResponsiveContainer width="100%" height="100%">
											<BarChart data={gradeChartData}>
												<CartesianGrid strokeDasharray="3 3" stroke="rgba(30, 41, 59, 0.12)" />
												<XAxis dataKey="name" stroke="#475569" interval={0} angle={-12} textAnchor="end" height={60} />
												<YAxis stroke="#475569" allowDecimals={false} tickFormatter={(value) => numberFormatter.format(value)} />
												<Tooltip formatter={(value) => numberFormatter.format(value ?? 0)} />
												<Bar dataKey="value" radius={[6, 6, 0, 0]}>
													{gradeChartData.map((entry, index) => (
														<Cell key={`grade-cell-${entry.name}`} fill={entry.color} />
													))}
												</Bar>
											</BarChart>
									</ResponsiveContainer>
								</div>
								) : (
									<p className="admin-empty">Chưa có dữ liệu lớp / độ tuổi.</p>
								)}
							</div>
							<div className="admin-card">
								<h4>Chương trình tham gia</h4>
								<ul className="admin-pill-list">
									{programList.map((item) => (
										<li key={`program-${item.label}`}>
											<span className="pill-label">{item.label}</span>
											<span className="pill-count">{numberFormatter.format(item.count ?? 0)}</span>
										</li>
									))}
								</ul>
								<h4>Mục tiêu học tập</h4>
								<ul className="admin-pill-list">
									{goalList.map((item) => (
										<li key={`goal-${item.label}`}>
											<span className="pill-label">{item.label}</span>
											<span className="pill-count">{numberFormatter.format(item.count ?? 0)}</span>
										</li>
									))}
								</ul>
								<h4>Chủ đề yêu thích</h4>
								<ul className="admin-pill-list">
									{favoriteTopicsList.map((item) => (
										<li key={`topic-${item.label}`}>
											<span className="pill-label">{item.label}</span>
											<span className="pill-count">{numberFormatter.format(item.count ?? 0)}</span>
										</li>
									))}
								</ul>
							</div>
							<div className="admin-chart-card">
								<h4>Giọng điệu trả lời</h4>
								{toneChartData.length > 0 ? (
									<div className="chart-container chart-container--small">
										<ResponsiveContainer width="100%" height="100%">
											<PieChart>
												<Pie data={toneChartData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={4}>
													{toneChartData.map((entry, index) => (
														<Cell key={`tone-cell-${entry.name}`} fill={entry.color} />
													))}
												</Pie>
												<Tooltip formatter={(value, name) => [numberFormatter.format(value ?? 0), name]} />
												<Legend verticalAlign="bottom" height={36} />
											</PieChart>
										</ResponsiveContainer>
									</div>
								) : (
									<p className="admin-empty">Chưa có dữ liệu giọng điệu.</p>
								)}
							</div>
							<div className="admin-chart-card">
								<h4>Mức độ chi tiết & tuỳ chọn</h4>
								<div className="admin-subgrid">
									<div className="chart-container chart-container--small">
										{detailChartData.length > 0 ? (
											<ResponsiveContainer width="100%" height="100%">
												<PieChart>
													<Pie data={detailChartData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={4}>
														{detailChartData.map((entry, index) => (
															<Cell key={`detail-cell-${entry.name}`} fill={entry.color} />
														))}
													</Pie>
													<Tooltip formatter={(value, name) => [numberFormatter.format(value ?? 0), `Chi tiết ${name}`]} />
													<Legend verticalAlign="bottom" height={32} />
												</PieChart>
											</ResponsiveContainer>
										) : (
											<p className="admin-empty">Chưa có dữ liệu mức chi tiết.</p>
										)}
									</div>
									<div className="chart-container chart-container--small">
										<ResponsiveContainer width="100%" height="100%">
											<PieChart>
												<Pie data={includeScratchChart} dataKey="value" nameKey="name" innerRadius={35} outerRadius={65} startAngle={210} endAngle={-30}>
													{includeScratchChart.map((entry, index) => (
														<Cell key={`scratch-toggle-${entry.name}`} fill={entry.color} />
													))}
												</Pie>
												<Tooltip formatter={(value, name) => [numberFormatter.format(value ?? 0), `Hướng dẫn Scratch: ${name}`]} />
												<Legend verticalAlign="bottom" height={28} />
											</PieChart>
										</ResponsiveContainer>
									</div>
									<div className="chart-container chart-container--small">
										<ResponsiveContainer width="100%" height="100%">
											<PieChart>
												<Pie data={includePracticeChart} dataKey="value" nameKey="name" innerRadius={35} outerRadius={65} startAngle={210} endAngle={-30}>
													{includePracticeChart.map((entry, index) => (
														<Cell key={`practice-toggle-${entry.name}`} fill={entry.color} />
													))}
												</Pie>
												<Tooltip formatter={(value, name) => [numberFormatter.format(value ?? 0), `Gợi ý luyện tập: ${name}`]} />
												<Legend verticalAlign="bottom" height={28} />
											</PieChart>
										</ResponsiveContainer>
									</div>
								</div>
							</div>
						</div>
					</section>

					<section className="admin-section">
						<h3>Phiên trò chuyện gần đây</h3>
						<div className="admin-table-wrapper">
							<table className="admin-table">
								<thead>
									<tr>
										<th>Phiên</th>
										<th>Bắt đầu</th>
										<th>Cập nhật</th>
										<th>Tin nhắn</th>
										<th>Chủ đề chính</th>
									</tr>
								</thead>
								<tbody>
									{(sessionsInfo.recent ?? []).map((session) => {
										const sessionLabel = session.displayTitle || session.title || session.id;
										return (
											<tr key={session.id}>
												<td>{sessionLabel}</td>
												<td>{session.createdAt ? dateTimeFormatter.format(new Date(session.createdAt)) : "-"}</td>
												<td>{session.lastActiveAt ? dateTimeFormatter.format(new Date(session.lastActiveAt)) : "-"}</td>
												<td>
													{numberFormatter.format(session.totalMessages ?? 0)} ({numberFormatter.format(session.userMessages ?? 0)} HS /
													{" "}
													{numberFormatter.format(session.assistantMessages ?? 0)} cô)
												</td>
												<td>{(session.topTopics ?? []).slice(0, 3).join(", ") || "-"}</td>
										</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					</section>

					<section className="admin-section">
						<h3>Tin nhắn gần nhất</h3>
						<div className="admin-table-wrapper">
							<table className="admin-table">
								<thead>
									<tr>
										<th>Thời gian</th>
										<th>Phiên</th>
										<th>Vai trò</th>
										<th>Nội dung</th>
										<th>Liên kết tài liệu</th>
									</tr>
								</thead>
								<tbody>
									{(messagesInfo.recent ?? []).map((message, index) => (
										<tr key={`message-${index}`}>
											<td>{message.timestamp ? dateTimeFormatter.format(new Date(message.timestamp)) : "-"}</td>
											<td>{message.sessionId}</td>
											<td>{message.role === "assistant" ? "Cô MindX" : "Học sinh"}</td>
											<td>{truncate(message.content)}</td>
											<td>{(message.references ?? []).slice(0, 3).join(", ") || "-"}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>
				</>
			) : (
				<div className="admin-empty">Chưa có dữ liệu thống kê để hiển thị.</div>
			)}
		</div>
	);
}

