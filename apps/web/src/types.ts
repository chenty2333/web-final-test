export type User = {
  id: string;
  email: string;
  displayName: string;
  role: "user" | "admin";
};

export type Category = {
  id: string;
  name: string;
  icon: string;
  color: string;
  monthlyLimit: number;
  userOwned: boolean;
};

export type Entry = {
  id: string;
  categoryId: string;
  title: string;
  amount: number;
  kind: "income" | "expense";
  accountName: string;
  scene: string;
  mood: string;
  note: string;
  occurredOn: string;
  reviewedAt?: string;
  category: {
    name: string;
    icon: string;
    color: string;
  };
};

export type CommunityComment = {
  id: string;
  body: string;
  authorName: string;
  createdAt: string;
};

export type CommunityPost = {
  id: string;
  topic: string;
  title: string;
  body: string;
  monthlyContext: string;
  visibility: "public" | "anonymous";
  authorName: string;
  isMine: boolean;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  createdAt: string;
  comments: CommunityComment[];
};

export type DashboardData = {
  month: string;
  user: User;
  summary: {
    income: number;
    expense: number;
    balance: number;
    netAssets: number;
    dailyAllowance: number;
    projectedExpense: number;
  };
  trend: Array<{
    month: string;
    income: number;
    expense: number;
    balance: number;
  }>;
  budgetLanes: Array<{
    id: string;
    name: string;
    color: string;
    spent: number;
    limit: number;
    rate: number;
  }>;
  risk: {
    name: string;
    rate: number;
  } | null;
  recentEntries: Entry[];
  topCategories: Array<{
    name: string;
    color: string;
    amount: number;
    share: number;
  }>;
  accounts: Array<{
    name: string;
    balance: number;
    entryCount: number;
    lastActivity: string;
  }>;
  goals: Array<{
    id: string;
    name: string;
    target: number;
    saved: number;
    deadline: string;
    progress: number;
    status: string;
  }>;
  recurring: Array<{
    id: string;
    title: string;
    amount: number;
    nextOn: string;
    status: string;
  }>;
  coach: Array<{
    tone: string;
    title: string;
    body: string;
    action: string;
  }>;
  generatedAt: string;
};

export type MonitorOverview = {
  window: string;
  sampleRate: number;
  generatedAt: string;
  summary: {
    capturedRequests: number;
    writeRequests: number;
    errorRate: number;
    avgDurationMs: number;
    p95DurationMs: number;
    requestsPerMinute: number;
  };
  series: Array<{
    label: string;
    requests: number;
    errors: number;
    avgMs: number;
  }>;
  endpoints: Array<{
    method: string;
    path: string;
    count: number;
    errors: number;
    avgMs: number;
    p95Ms: number;
  }>;
  recent: Array<{
    id: string;
    method: string;
    path: string;
    status: number;
    durationMs: number;
    requestId: string;
    createdAt: string;
    userAgent: string;
  }>;
};

export type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  role: "user" | "admin";
  createdAt: string;
  updatedAt: string;
  entryCount: number;
  lastSessionAt: string;
};

export type AdminOverview = {
  currentUser: User;
  generatedAt: string;
  summary: {
    users: number;
    admins: number;
    activeSessions: number;
    entries: number;
    communityPosts: number;
    communityComments: number;
    requests24h: number;
    errorRate24h: number;
  };
  users: AdminUser[];
  recentRequests: Array<{
    id: string;
    method: string;
    path: string;
    status: number;
    durationMs: number;
    requestId: string;
    userEmail: string;
    createdAt: string;
    userAgent: string;
  }>;
  topEndpoints: Array<{
    method: string;
    path: string;
    count: number;
    errors: number;
    avgMs: number;
  }>;
};
