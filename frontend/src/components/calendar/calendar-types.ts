export type CalendarFileType = "pdf" | "xml" | "report";

export type DayStatus =
  | "empty"
  | "uploaded"
  | "pending"
  | "processed";

export type CalendarFile = {
  id: number;
  name: string;
  type: CalendarFileType;
  size?: string;
  mimeType?: string | null;
  uploadedAt?: string;
};

export type CalendarDayData = {
  date: string;
  files: CalendarFile[];
  pendingMembers: number;
  status: DayStatus;
};

export type UploadFilePayload = {
  date: string;
  type: CalendarFileType;
  file: File;
};