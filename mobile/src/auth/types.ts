export type LjingleUser = {
  id: string;
  email: string;
  username: string;
  createdAt?: string;
};

export type LjingleAuthSession = {
  token: string;
  user: LjingleUser;
};

export type LjingleRegistration = {
  email: string;
  username: string;
  password: string;
  inviteCode: string;
};
