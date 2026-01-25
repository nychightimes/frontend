import { mysqlTable, mysqlSchema, AnyMySqlColumn, varchar, text, datetime, unique, int, date, time, tinyint } from "drizzle-orm/mysql-core"
import { sql } from "drizzle-orm"

export const account = mysqlTable("account", {
	userId: varchar({ length: 255 }).notNull(),
	type: varchar({ length: 255 }).notNull(),
	provider: varchar({ length: 255 }).notNull(),
	providerAccountId: varchar({ length: 255 }).notNull(),
	refreshToken: text("refresh_token").default('NULL'),
	accessToken: text("access_token").default('NULL'),
	expiresAt: datetime("expires_at", { mode: 'string'}).default('NULL'),
	tokenType: varchar("token_type", { length: 255 }).default('NULL'),
	scope: varchar({ length: 255 }).default('NULL'),
	idToken: text("id_token").default('NULL'),
	sessionState: varchar("session_state", { length: 255 }).default('NULL'),
});

export const adminLogs = mysqlTable("admin_logs", {
	id: varchar({ length: 255 }).notNull(),
	adminId: varchar({ length: 255 }).notNull(),
	action: varchar({ length: 255 }).notNull(),
	details: text().default('NULL'),
	createdAt: datetime({ mode: 'string'}).default('current_timestamp()'),
});

export const adminRoles = mysqlTable("admin_roles", {
	id: varchar({ length: 255 }).notNull(),
	name: varchar({ length: 255 }).notNull(),
	permissions: text().notNull(),
	createdAt: datetime({ mode: 'string'}).default('current_timestamp()'),
	updatedAt: datetime({ mode: 'string'}).default('current_timestamp()'),
});

export const adminUsers = mysqlTable("admin_users", {
	id: varchar({ length: 255 }).notNull(),
	email: varchar({ length: 255 }).notNull(),
	password: varchar({ length: 255 }).notNull(),
	name: varchar({ length: 255 }).default('NULL'),
	roleId: varchar({ length: 255 }).notNull(),
	role: varchar({ length: 255 }).notNull(),
	createdAt: datetime({ mode: 'string'}).default('current_timestamp()'),
	updatedAt: datetime({ mode: 'string'}).default('current_timestamp()'),
},
(table) => [
	unique("admin_users_email_unique").on(table.email),
]);

export const attendance = mysqlTable("attendance", {
	id: varchar({ length: 255 }).notNull(),
	userId: varchar({ length: 255 }).notNull(),
	batchId: varchar({ length: 255 }).notNull(),
	date: datetime({ mode: 'string'}).default('current_timestamp()'),
	time: datetime({ mode: 'string'}).default('current_timestamp()'),
	createdAt: datetime({ mode: 'string'}).default('current_timestamp()'),
});

export const batches = mysqlTable("batches", {
	id: varchar({ length: 255 }).notNull(),
	batchName: varchar({ length: 255 }).notNull(),
	courseId: varchar({ length: 255 }).notNull(),
	startDate: datetime({ mode: 'string'}).notNull(),
	endDate: datetime({ mode: 'string'}).notNull(),
	capacity: int().notNull(),
	image: varchar({ length: 500 }).default('NULL'),
	description: text().default('NULL'),
	createdAt: datetime({ mode: 'string'}).default('current_timestamp()'),
	updatedAt: datetime({ mode: 'string'}).default('current_timestamp()'),
});

export const courses = mysqlTable("courses", {
	id: varchar({ length: 255 }).notNull(),
	featured: int().notNull(),
	title: varchar({ length: 255 }).notNull(),
	description: text().default('NULL'),
	image: varchar({ length: 255 }).default('NULL'),
	price: int().notNull(),
	createdAt: datetime({ mode: 'string'}).default('current_timestamp()'),
	updatedAt: datetime({ mode: 'string'}).default('current_timestamp()'),
});

export const orders = mysqlTable("orders", {
	id: varchar({ length: 255 }).notNull(),
	userId: varchar({ length: 255 }).notNull(),
	courseId: varchar({ length: 255 }).notNull(),
	batchId: varchar({ length: 255 }).default('NULL'),
	status: varchar({ length: 50 }).default('\'pending\'').notNull(),
	transactionId: varchar({ length: 255 }).default('NULL'),
	transactionScreenshot: varchar({ length: 255 }).default('NULL'),
	message: text().notNull(),
	firstName: varchar({ length: 100 }).default('NULL'),
	lastName: varchar({ length: 100 }).default('NULL'),
	email: varchar({ length: 255 }).default('NULL'),
	phone: varchar({ length: 20 }).default('NULL'),
	country: varchar({ length: 100 }).default('NULL'),
	address: varchar({ length: 255 }).default('NULL'),
	city: varchar({ length: 100 }).default('NULL'),
	state: varchar({ length: 100 }).default('NULL'),
	createdAt: datetime({ mode: 'string'}).default('current_timestamp()'),
	updatedAt: datetime({ mode: 'string'}).default('current_timestamp()'),
});

// Coupons
export const coupons = mysqlTable("coupons", {
	id: varchar({ length: 255 }).notNull(),
	code: varchar({ length: 64 }).notNull(),
	name: varchar({ length: 255 }).default('NULL'),
	description: text("description").default('NULL'),
	discountType: varchar("discount_type", { length: 20 }).notNull(),
	discountValue: varchar("discount_value", { length: 50 }).notNull(),
	maxDiscountAmount: varchar("max_discount_amount", { length: 50 }).default('NULL'),
	minSubtotal: varchar("min_subtotal", { length: 50 }).default('NULL'),
	startAt: datetime("start_at", { mode: 'string'}).default('NULL'),
	endAt: datetime("end_at", { mode: 'string'}).default('NULL'),
	isActive: tinyint("is_active").default(1),
	usageLimitTotal: int("usage_limit_total"),
	usageLimitPerUser: int("usage_limit_per_user"),
	firstOrderOnly: tinyint("first_order_only").default(0),
	createdAt: datetime("created_at", { mode: 'string'}).default('current_timestamp()'),
	updatedAt: datetime("updated_at", { mode: 'string'}).default('current_timestamp()'),
},
(table) => [
	unique("coupons_code_unique").on(table.code),
]);

export const couponIncludedProducts = mysqlTable("coupon_included_products", {
	id: varchar({ length: 255 }).notNull(),
	couponId: varchar("coupon_id", { length: 255 }).notNull(),
	productId: varchar("product_id", { length: 255 }).notNull(),
	createdAt: datetime("created_at", { mode: 'string'}).default('current_timestamp()'),
});

export const couponExcludedProducts = mysqlTable("coupon_excluded_products", {
	id: varchar({ length: 255 }).notNull(),
	couponId: varchar("coupon_id", { length: 255 }).notNull(),
	productId: varchar("product_id", { length: 255 }).notNull(),
	createdAt: datetime("created_at", { mode: 'string'}).default('current_timestamp()'),
});

export const couponIncludedCategories = mysqlTable("coupon_included_categories", {
	id: varchar({ length: 255 }).notNull(),
	couponId: varchar("coupon_id", { length: 255 }).notNull(),
	categoryId: varchar("category_id", { length: 255 }).notNull(),
	createdAt: datetime("created_at", { mode: 'string'}).default('current_timestamp()'),
});

export const couponExcludedCategories = mysqlTable("coupon_excluded_categories", {
	id: varchar({ length: 255 }).notNull(),
	couponId: varchar("coupon_id", { length: 255 }).notNull(),
	categoryId: varchar("category_id", { length: 255 }).notNull(),
	createdAt: datetime("created_at", { mode: 'string'}).default('current_timestamp()'),
});

export const couponRedemptions = mysqlTable("coupon_redemptions", {
	id: varchar({ length: 255 }).notNull(),
	couponId: varchar("coupon_id", { length: 255 }).notNull(),
	orderId: varchar("order_id", { length: 255 }).default('NULL'),
	userId: varchar("user_id", { length: 255 }).default('NULL'),
	email: varchar({ length: 255 }).default('NULL'),
	codeSnapshot: varchar("code_snapshot", { length: 64 }).notNull(),
	discountAmount: varchar("discount_amount", { length: 50 }).notNull(),
	status: varchar({ length: 20 }).default('\'redeemed\'').notNull(),
	redeemedAt: datetime("redeemed_at", { mode: 'string'}).default('current_timestamp()'),
});

export const recordings = mysqlTable("recordings", {
	id: varchar({ length: 255 }).notNull(),
	recordingTitle: varchar({ length: 255 }).notNull(),
	batchId: varchar({ length: 255 }).notNull(),
	recordingDateTime: datetime({ mode: 'string'}).notNull(),
	recordingUrl: varchar({ length: 500 }).default('NULL'),
	showToAllUsers: tinyint().default(1),
	createdAt: datetime({ mode: 'string'}).default('current_timestamp()'),
	updatedAt: datetime({ mode: 'string'}).default('current_timestamp()'),
});

export const sessions = mysqlTable("sessions", {
	sessionToken: varchar({ length: 255 }).notNull(),
	userId: varchar({ length: 255 }).notNull(),
	expires: datetime({ mode: 'string'}).notNull(),
});

export const user = mysqlTable("user", {
	id: varchar({ length: 255 }).notNull(),
	name: varchar({ length: 255 }).default('NULL'),
	firstName: varchar("first_name", { length: 100 }).default('NULL'),
	lastName: varchar("last_name", { length: 100 }).default('NULL'),
	email: varchar({ length: 255 }).notNull(),
	emailVerified: datetime({ mode: 'string'}).default('NULL'),
	image: text().default('NULL'),
	profilePicture: varchar("profile_picture", { length: 255 }).default('NULL'),
	username: varchar({ length: 100 }).default('NULL'),
	displayName: varchar("display_name", { length: 100 }).default('NULL'),
	skill: varchar({ length: 100 }).default('NULL'),
	occupation: varchar({ length: 100 }).default('NULL'),
	country: varchar({ length: 100 }).default('NULL'),
	city: varchar({ length: 100 }).default('NULL'),
	address: varchar({ length: 100 }).default('NULL'),
	state: varchar({ length: 100 }).default('NULL'),
	aboutMe: text("about_me").default('NULL'),
	newsletter: tinyint().default(0),
	phone: varchar({ length: 20 }).default('NULL'),
	postalCode: varchar("postal_code", { length: 20 }).default('NULL'),
	otp: varchar({ length: 6 }).default('NULL'),
	otpExpiry: datetime("otp_expiry", { mode: 'string'}).default('NULL'),
	// Notification preferences
	notifyOrderUpdates: tinyint("notify_order_updates").default(1),
	notifyPromotions: tinyint("notify_promotions").default(0),
	notifyDriverMessages: tinyint("notify_driver_messages").default(1),
	createdAt: datetime("created_at", { mode: 'string'}).default('current_timestamp()'),
	updatedAt: datetime("updated_at", { mode: 'string'}).default('current_timestamp()'),
},
(table) => [
	unique("user_email_unique").on(table.email),
]);

export const verificationTokens = mysqlTable("verification_tokens", {
	identifier: varchar({ length: 255 }).notNull(),
	token: varchar({ length: 255 }).notNull(),
	otp: varchar({ length: 255 }).notNull(),
	expires: datetime({ mode: 'string'}).notNull(),
});

export const zoomLinks = mysqlTable("zoom_links", {
	id: varchar({ length: 255 }).notNull(),
	batchId: varchar({ length: 255 }).notNull(),
	url: varchar({ length: 500 }).notNull(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	date: date({ mode: 'string' }).notNull(),
	startTime: time().notNull(),
	endTime: time().notNull(),
	createdAt: datetime({ mode: 'string'}).default('current_timestamp()'),
	updatedAt: datetime({ mode: 'string'}).default('current_timestamp()'),
});
