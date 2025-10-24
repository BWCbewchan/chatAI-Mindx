import { useEffect, useState } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
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
	shortDateFormatter,
	classFilter,
	onClassFilterChange,
	selectedClass,
	onClassClick,
	selectedStudent,
	onStudentClick,
	studentModalOpen,
	onCloseStudentModal,
	studentChatHistory,
	studentChatLoading
}) {
	const [activeSection, setActiveSection] = useState("filter-section");

	useEffect(() => {
		// Use Intersection Observer for better performance and accuracy
		const observerOptions = {
			root: null,
			rootMargin: "-20% 0px -60% 0px", // Trigger when section is in upper 20-40% of viewport
			threshold: 0
		};

		const observerCallback = (entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					const sectionId = entry.target.id;
					setActiveSection(sectionId);
					console.log("Active section:", sectionId);
				}
			});
		};

		const observer = new IntersectionObserver(observerCallback, observerOptions);

		// Observe all sections
		const sections = [
			"filter-section",
			"detailed-stats",
			"activity-overview",
			"study-time",
			"topics",
			"grade-distribution",
			"student-profile",
			"recent-sessions",
			"recent-messages"
		];

		sections.forEach((sectionId) => {
			const element = document.getElementById(sectionId);
			if (element) {
				observer.observe(element);
			}
		});

		// Cleanup
		return () => {
			sections.forEach((sectionId) => {
				const element = document.getElementById(sectionId);
				if (element) {
					observer.unobserve(element);
				}
			});
		};
	}, []);

	const allowDashboard = isAdminAuthenticated;

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
					<button type="button" className="toolbar-button subtle" onClick={onReturnToChat}>
						⬅️ Quay lại chat
					</button>
				</div>
			</div>
		);
	}

	const hasRealData = Boolean(analyticsData);
	const dataSource = analyticsData;

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

	const toneChartData = toneDistribution.map((item, index) => ({
		name: item.label,
		value: item.count ?? item.value ?? 0,
		color: PIE_COLORS[index % PIE_COLORS.length]
	}));

	const styleChartData = [
		{ name: "Thân thiện", value: 15, color: PIE_COLORS[0] },
		{ name: "Chuyên nghiệp", value: 8, color: PIE_COLORS[1] },
		{ name: "Vui vẻ", value: 12, color: PIE_COLORS[2] }
	];

	const detailChartData = detailDistribution.map((item, index) => ({
		name: item.label,
		value: item.count ?? item.value ?? 0,
		color: PIE_COLORS[(index + 2) % PIE_COLORS.length]
	}));


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
			{/* Left Sidebar Navigation */}
			<div className="dashboard-sidebar">
				<div className="sidebar-header">
					<h3>📑 Nội dung</h3>
					<p>Chuyển nhanh</p>
				</div>
				<nav className="sidebar-nav">
					<a 
						href="#filter-section" 
						className={`sidebar-link ${activeSection === "filter-section" ? "active" : ""}`}
						onClick={(e) => {
							e.preventDefault();
							document.getElementById("filter-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
						}}
					>
						<span className="link-icon">🔍</span>
						<span className="link-text">Lọc dữ liệu</span>
					</a>
					<a 
						href="#detailed-stats" 
						className={`sidebar-link ${activeSection === "detailed-stats" ? "active" : ""}`}
						onClick={(e) => {
							e.preventDefault();
							document.getElementById("detailed-stats")?.scrollIntoView({ behavior: "smooth", block: "start" });
						}}
					>
						<span className="link-icon">📊</span>
						<span className="link-text">Thống kê chi tiết</span>
					</a>
					<a 
						href="#activity-overview" 
						className={`sidebar-link ${activeSection === "activity-overview" ? "active" : ""}`}
						onClick={(e) => {
							e.preventDefault();
							document.getElementById("activity-overview")?.scrollIntoView({ behavior: "smooth", block: "start" });
						}}
					>
						<span className="link-icon">📈</span>
						<span className="link-text">Tổng quan hoạt động</span>
					</a>
					<a 
						href="#study-time" 
						className={`sidebar-link ${activeSection === "study-time" ? "active" : ""}`}
						onClick={(e) => {
							e.preventDefault();
							document.getElementById("study-time")?.scrollIntoView({ behavior: "smooth", block: "start" });
						}}
					>
						<span className="link-icon">⏰</span>
						<span className="link-text">Thời gian học tập</span>
					</a>
					<a 
						href="#topics" 
						className={`sidebar-link ${activeSection === "topics" ? "active" : ""}`}
						onClick={(e) => {
							e.preventDefault();
							document.getElementById("topics")?.scrollIntoView({ behavior: "smooth", block: "start" });
						}}
					>
						<span className="link-icon">📚</span>
						<span className="link-text">Chủ đề & tài liệu</span>
					</a>
					<a 
						href="#grade-distribution" 
						className={`sidebar-link ${activeSection === "grade-distribution" ? "active" : ""}`}
						onClick={(e) => {
							e.preventDefault();
							document.getElementById("grade-distribution")?.scrollIntoView({ behavior: "smooth", block: "start" });
						}}
					>
						<span className="link-icon">🎓</span>
						<span className="link-text">Phân bố lớp</span>
					</a>
					<a 
						href="#student-profile" 
						className={`sidebar-link ${activeSection === "student-profile" ? "active" : ""}`}
						onClick={(e) => {
							e.preventDefault();
							document.getElementById("student-profile")?.scrollIntoView({ behavior: "smooth", block: "start" });
						}}
					>
						<span className="link-icon">👥</span>
						<span className="link-text">Hồ sơ học sinh</span>
					</a>
					<a 
						href="#recent-sessions" 
						className={`sidebar-link ${activeSection === "recent-sessions" ? "active" : ""}`}
						onClick={(e) => {
							e.preventDefault();
							document.getElementById("recent-sessions")?.scrollIntoView({ behavior: "smooth", block: "start" });
						}}
					>
						<span className="link-icon">💬</span>
						<span className="link-text">Phiên gần đây</span>
					</a>
					<a 
						href="#recent-messages" 
						className={`sidebar-link ${activeSection === "recent-messages" ? "active" : ""}`}
						onClick={(e) => {
							e.preventDefault();
							document.getElementById("recent-messages")?.scrollIntoView({ behavior: "smooth", block: "start" });
						}}
					>
						<span className="link-icon">✉️</span>
						<span className="link-text">Tin nhắn gần nhất</span>
					</a>
				</nav>
			</div>

			{/* Main Dashboard Content */}
			<div className="admin-dashboard-content">
			<div className="admin-dashboard-header">
				<div className="admin-dashboard-title">
					<div className="title-main">
						<h2 className="dashboard-title">
							<span className="title-icon">📊</span>
							<span className="title-text">Dashboard Analytics</span>
						</h2>
						<p className="dashboard-subtitle">
							Thống kê và phân tích dữ liệu học viên MindX
						</p>
					</div>
					{selectedClass && (
						<div className="dashboard-status">
							<div className="status-content">
								<span className="status-icon">🎯</span>
								<span className="status-text">
									Đang xem chi tiết lớp: <strong>{selectedClass}</strong>
								</span>
							</div>
							<button 
								className="status-clear-btn"
								onClick={() => onClassClick(selectedClass)}
							>
								<span className="btn-icon">✕</span>
								<span className="btn-text">Bỏ lọc</span>
							</button>
						</div>
					)}
					<div className="admin-dashboard-meta">
						{generatedAtLabel && (
							<div className="meta-item">
								<span className="meta-icon">🕒</span>
								<span className="meta-text">Cập nhật lúc {generatedAtLabel}</span>
							</div>
						)}
						{analyticsLastUpdated && (
							<div className="meta-item">
								<span className="meta-icon">🔄</span>
								<span className="meta-text">Làm mới {dateTimeFormatter.format(new Date(analyticsLastUpdated))}</span>
							</div>
						)}
					</div>
				</div>
				<div className="admin-dashboard-actions">
					<button type="button" className="toolbar-button toolbar-button--secondary" onClick={onReturnToChat}>
						<span className="btn-icon">⬅️</span>
						<span className="btn-text">Quay lại chat</span>
					</button>
					<button type="button" className="toolbar-button toolbar-button--primary" onClick={() => onRefresh()} disabled={analyticsLoading}>
						<span className="btn-icon">{analyticsLoading ? "⏳" : "🔄"}</span>
						<span className="btn-text">{analyticsLoading ? "Đang tải..." : "Làm mới"}</span>
					</button>
					<button
						type="button"
						className="toolbar-button toolbar-button--danger"
						onClick={onLogout}
					>
						<span className="btn-icon">🚪</span>
						<span className="btn-text">Đăng xuất</span>
					</button>
				</div>
			</div>

			<div className="admin-dashboard-filters" id="filter-section">
				<div className="filter-section">
					<div className="filter-header">
						<div className="filter-title">
							<span className="filter-icon">🔍</span>
							<span className="filter-text">Lọc dữ liệu</span>
						</div>
						<div className="filter-subtitle">
							Tìm kiếm theo lớp học hoặc cơ sở
						</div>
					</div>
					<div className="filter-input-group">
						<div className="filter-input-wrapper">
							<input
								id="class-filter"
								type="text"
								value={classFilter}
								onChange={(event) => onClassFilterChange(event.target.value)}
								placeholder="Nhập cơ sở (TK) hoặc mã lớp (SB24, SA15, SI08...)"
								className="filter-input"
							/>
							<div className="filter-input-icon"></div>
						</div>
						{classFilter && (
							<button
								type="button"
								className="filter-clear-button"
								onClick={() => onClassFilterChange("")}
							>
								<span className="btn-icon">✕</span>
								<span className="btn-text">Xóa bộ lọc</span>
							</button>
						)}
					</div>
					<div className="filter-help">
						<div className="help-content">
							<div className="help-item">
								<span className="help-icon">💡</span>
								<span className="help-text"><strong>Cơ sở:</strong> TK → Tất cả lớp của cơ sở TK</span>
							</div>
							<div className="help-item">
								<span className="help-icon">💡</span>
								<span className="help-text"><strong>Mã lớp:</strong> SB24 → Chỉ lớp SB24 (từ mọi cơ sở)</span>
							</div>
							<div className="help-item">
								<span className="help-icon">🎯</span>
								<span className="help-text"><strong>Ưu tiên:</strong> Lọc chính xác theo lớp học</span>
							</div>
						</div>
					</div>
					{classFilter && (
						<div className="filter-status">
							<span className="filter-active">
								📊 Đang hiển thị dữ liệu cho: <strong>{classFilter}</strong>
								{classFilter.length <= 3 ? " (cơ sở)" : " (mã lớp)"}
							</span>
						</div>
					)}
				</div>
			</div>

			{!hasRealData && !analyticsLoading && (
				<div className="admin-sample-banner">
					<span role="img" aria-hidden="true">✨</span>
					<span>
						Chưa có dữ liệu thống kê. Khi có cuộc trò chuyện thật, bảng điều khiển sẽ tự động cập nhật số liệu.
					</span>
				</div>
			)}

			{/* Detailed Statistics Section */}
			{hasRealData && (
				<section className="admin-section" id="detailed-stats">
					<h3>📊 Thống kê chi tiết</h3>
					<div className="admin-grid">
						<div className="admin-card">
							<h4>🏢 Thống kê cơ sở</h4>
							<div className="stats-grid">
								<div className="stat-item">
									<span className="stat-label">Tổng số cơ sở</span>
									<span className="stat-value">{dataSource.summary.centerStats?.length || 0}</span>
								</div>
								<div className="stat-item">
									<span className="stat-label">Tổng số lớp</span>
									<span className="stat-value">{dataSource.summary.totalClasses || 0}</span>
								</div>
								<div className="stat-item">
									<span className="stat-label">Tổng số học viên</span>
									<span className="stat-value">{dataSource.summary.totalStudents || 0}</span>
								</div>
							</div>
							{dataSource.summary.centerStats?.length > 0 && (
								<div className="stats-list">
									<h5>Cơ sở</h5>
									<ul className="admin-pill-list">
										{dataSource.summary.centerStats.slice(0, 10).map((item) => (
											<li key={`center-${item.label}`}>
												<span className="pill-label">{item.label}</span>
												<span className="pill-count">{numberFormatter.format(item.count ?? 0)}</span>
											</li>
										))}
									</ul>
								</div>
							)}
						</div>
						
						<div className="admin-card">
							<h4>🎓 Thống kê lớp học</h4>
							{dataSource.summary.classStats?.length > 0 ? (
								<div className="stats-list">
									<div className="class-filter-hint">
										💡 Click vào lớp để xem chi tiết, click lại để xem tổng quan
									</div>
									<ul className="admin-pill-list admin-pill-list--interactive">
										{dataSource.summary.classStats.slice(0, 15).map((item) => (
											<li 
												key={`class-${item.label}`}
												className={`admin-pill-item ${selectedClass === item.label ? 'selected' : ''}`}
												onClick={() => onClassClick(item.label)}
											>
												<span className="pill-label">{item.label}</span>
												<span className="pill-count">{numberFormatter.format(item.count ?? 0)}</span>
												{selectedClass === item.label && (
													<span className="pill-indicator">✓</span>
												)}
											</li>
										))}
									</ul>
								</div>
							) : (
								<p className="admin-empty">Chưa có dữ liệu lớp học.</p>
							)}
						</div>
						
						<div className="admin-card">
							<h4>👥 Thống kê học viên</h4>
							{dataSource.summary.studentStats?.length > 0 ? (
								<div className="stats-list">
									<div className="student-filter-hint">
										💡 Click vào học viên để xem lịch sử chat
									</div>
									<ul className="admin-pill-list admin-pill-list--interactive">
										{dataSource.summary.studentStats.slice(0, 10).map((item) => (
											<li 
												key={`student-${item.label}`}
												className="admin-pill-item admin-pill-item--student"
												onClick={() => onStudentClick(item.label)}
											>
												<span className="pill-label">{item.label}</span>
												<span className="pill-count">{numberFormatter.format(item.count ?? 0)}</span>
												<span className="pill-action">👁️</span>
											</li>
										))}
									</ul>
								</div>
							) : (
								<p className="admin-empty">Chưa có dữ liệu học viên.</p>
							)}
						</div>
					</div>
				</section>
			)}

			{analyticsError && <div className="error admin-error">{analyticsError}</div>}

			{/* Student Chat History Modal */}
			{studentModalOpen && (
				<div className="overlay student-modal-overlay" role="dialog" aria-modal="true">
					<div className="overlay-content student-modal-content">
						<div className="overlay-card student-modal-card">
							<div className="student-modal-header">
								<div className="student-modal-title">
									<h2>💬 Lịch sử chat của {selectedStudent}</h2>
									<p>Xem các cuộc trò chuyện giữa học viên và cô MindX</p>
								</div>
								<button 
									className="student-modal-close"
									onClick={onCloseStudentModal}
									aria-label="Đóng modal"
								>
									❌
								</button>
							</div>
							
							<div className="student-modal-body">
								{studentChatLoading ? (
									<div className="student-chat-loading">
										<span>Đang tải lịch sử chat...</span>
									</div>
								) : studentChatHistory.length > 0 ? (
									<div className="student-chat-container">
										{studentChatHistory.map((message) => (
											<div 
												key={message.id}
												className={`student-chat-message student-chat-message--${message.role}`}
											>
												<div className="student-chat-message-header">
													<span className="student-chat-role">
														{message.role === 'user' ? '👤 Học viên' : '🤖 Cô MindX'}
													</span>
													<span className="student-chat-time">
														{dateTimeFormatter.format(new Date(message.timestamp))}
													</span>
												</div>
												<div className="student-chat-content">
													{message.content}
												</div>
											</div>
										))}
									</div>
								) : (
									<div className="student-chat-empty">
										<p>Không có lịch sử chat nào cho học viên này.</p>
									</div>
								)}
							</div>
						</div>
					</div>
				</div>
			)}

			{analyticsLoading && !hasRealData ? (
				<div className="admin-loading">Đang tải dữ liệu thống kê...</div>
			) : dataSource ? (
					<>
					<section className="admin-section" id="activity-overview">
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

					<section className="admin-section" id="study-time">
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

					<section className="admin-section" id="topics">
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
													{keywordChartData.map((entry) => (
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

					<section className="admin-section" id="grade-distribution">
						<h3>Phân bố lớp / độ tuổi</h3>
						<div className="admin-chart-card admin-chart-card--full">
							{gradeChartData.length > 0 ? (
								<div className="chart-container chart-container--wide">
									<ResponsiveContainer width="100%" height="100%">
										<BarChart data={gradeChartData}>
											<CartesianGrid strokeDasharray="3 3" stroke="rgba(30, 41, 59, 0.12)" />
											<XAxis dataKey="name" stroke="#475569" interval={0} angle={-12} textAnchor="end" height={60} />
											<YAxis stroke="#475569" allowDecimals={false} tickFormatter={(value) => numberFormatter.format(value)} />
											<Tooltip formatter={(value) => numberFormatter.format(value ?? 0)} />
											<Bar dataKey="value" radius={[6, 6, 0, 0]}>
												{gradeChartData.map((entry) => (
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
					</section>

					<section className="admin-section" id="student-profile">
						<h3>👥 Hồ sơ học sinh & cấu hình trả lời</h3>
						<div className="admin-profile-grid">
							{/* Student Profile Overview */}
							<div className="admin-profile-card admin-profile-card--overview">
								<div className="profile-card-header">
									<h4>📊 Tổng quan hồ sơ</h4>
									<div className="profile-stats">
										<div className="profile-stat-item">
											<span className="stat-icon">🎓</span>
											<span className="stat-label">Chương trình</span>
											<span className="stat-value">{programList.length}</span>
										</div>
										<div className="profile-stat-item">
											<span className="stat-icon">🎯</span>
											<span className="stat-label">Mục tiêu</span>
											<span className="stat-value">{goalList.length}</span>
										</div>
										<div className="profile-stat-item">
											<span className="stat-icon">❤️</span>
											<span className="stat-label">Sở thích</span>
											<span className="stat-value">{favoriteTopicsList.length}</span>
										</div>
									</div>
								</div>
							</div>

							{/* Program Participation */}
							<div className="admin-profile-card admin-profile-card--programs">
								<div className="profile-card-header">
									<h4>🎓 Chương trình tham gia</h4>
									<span className="profile-card-subtitle">Các khóa học học viên đang theo</span>
								</div>
								<div className="profile-content">
									{programList.length > 0 ? (
										<div className="profile-pill-grid">
											{programList.map((item) => (
												<div key={`program-${item.label}`} className="profile-pill-item profile-pill-item--program">
													<div className="pill-content">
														<span className="pill-icon">📚</span>
														<span className="pill-label">{item.label}</span>
													</div>
													<span className="pill-count">{numberFormatter.format(item.count ?? 0)}</span>
												</div>
											))}
										</div>
									) : (
										<div className="profile-empty">
											<span className="empty-icon">📚</span>
											<p>Chưa có dữ liệu chương trình</p>
										</div>
									)}
								</div>
							</div>

							{/* Learning Goals */}
							<div className="admin-profile-card admin-profile-card--goals">
								<div className="profile-card-header">
									<h4>🎯 Mục tiêu học tập</h4>
									<span className="profile-card-subtitle">Những gì học viên muốn đạt được</span>
								</div>
								<div className="profile-content">
									{goalList.length > 0 ? (
										<div className="profile-pill-grid">
											{goalList.map((item) => (
												<div key={`goal-${item.label}`} className="profile-pill-item profile-pill-item--goal">
													<div className="pill-content">
														<span className="pill-icon">🎯</span>
														<span className="pill-label">{item.label}</span>
													</div>
													<span className="pill-count">{numberFormatter.format(item.count ?? 0)}</span>
												</div>
											))}
										</div>
									) : (
										<div className="profile-empty">
											<span className="empty-icon">🎯</span>
											<p>Chưa có dữ liệu mục tiêu</p>
										</div>
									)}
								</div>
							</div>

							{/* Favorite Topics */}
							<div className="admin-profile-card admin-profile-card--topics">
								<div className="profile-card-header">
									<h4>❤️ Chủ đề yêu thích</h4>
									<span className="profile-card-subtitle">Những gì học viên quan tâm</span>
								</div>
								<div className="profile-content">
									{favoriteTopicsList.length > 0 ? (
										<div className="profile-pill-grid">
											{favoriteTopicsList.map((item) => (
												<div key={`topic-${item.label}`} className="profile-pill-item profile-pill-item--topic">
													<div className="pill-content">
														<span className="pill-icon">❤️</span>
														<span className="pill-label">{item.label}</span>
													</div>
													<span className="pill-count">{numberFormatter.format(item.count ?? 0)}</span>
												</div>
											))}
										</div>
									) : (
										<div className="profile-empty">
											<span className="empty-icon">❤️</span>
											<p>Chưa có dữ liệu sở thích</p>
										</div>
									)}
								</div>
							</div>

							{/* Response Configuration */}
							<div className="admin-profile-card admin-profile-card--response">
								<div className="profile-card-header">
									<h4>🤖 Cấu hình trả lời</h4>
									<span className="profile-card-subtitle">Cách AI tương tác với học viên</span>
								</div>
								<div className="response-charts">
									<div className="response-chart-item">
										<h5>🎭 Giọng điệu</h5>
										{toneChartData.length > 0 ? (
											<div className="chart-container chart-container--compact">
												<ResponsiveContainer width="100%" height="100%">
													<PieChart>
														<Pie data={toneChartData} dataKey="value" nameKey="name" innerRadius={30} outerRadius={60} paddingAngle={2}>
															{toneChartData.map((entry) => (
																<Cell key={`tone-cell-${entry.name}`} fill={entry.color} />
															))}
														</Pie>
														<Tooltip formatter={(value, name) => [numberFormatter.format(value ?? 0), name]} />
													</PieChart>
												</ResponsiveContainer>
											</div>
										) : (
											<div className="chart-empty">Chưa có dữ liệu</div>
										)}
									</div>
									
									<div className="response-chart-item">
										<h5>📝 Mức độ chi tiết</h5>
										{detailChartData.length > 0 ? (
											<div className="chart-container chart-container--compact">
												<ResponsiveContainer width="100%" height="100%">
													<PieChart>
														<Pie data={detailChartData} dataKey="value" nameKey="name" innerRadius={30} outerRadius={60} paddingAngle={2}>
															{detailChartData.map((entry) => (
																<Cell key={`detail-cell-${entry.name}`} fill={entry.color} />
															))}
														</Pie>
														<Tooltip formatter={(value, name) => [numberFormatter.format(value ?? 0), `Chi tiết ${name}`]} />
													</PieChart>
												</ResponsiveContainer>
											</div>
										) : (
											<div className="chart-empty">Chưa có dữ liệu</div>
										)}
									</div>
									
									<div className="response-chart-item">
										<h5>🎨 Phong cách</h5>
										{styleChartData.length > 0 ? (
											<div className="chart-container chart-container--compact">
												<ResponsiveContainer width="100%" height="100%">
													<PieChart>
														<Pie data={styleChartData} dataKey="value" nameKey="name" innerRadius={30} outerRadius={60} paddingAngle={2}>
															{styleChartData.map((entry) => (
																<Cell key={`style-cell-${entry.name}`} fill={entry.color} />
															))}
														</Pie>
														<Tooltip formatter={(value, name) => [numberFormatter.format(value ?? 0), `Phong cách ${name}`]} />
													</PieChart>
												</ResponsiveContainer>
											</div>
										) : (
											<div className="chart-empty">Chưa có dữ liệu</div>
										)}
									</div>
								</div>
							</div>
						</div>
					</section>

					<section className="admin-section" id="recent-sessions">
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

					<section className="admin-section" id="recent-messages">
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
			{/* End Dashboard Content */}
		</div>
	);
}

