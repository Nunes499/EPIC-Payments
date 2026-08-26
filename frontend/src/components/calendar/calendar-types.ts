export type CalendarFileType =
  | "pdf"
  | "xml"
  | "report";

export type BankFileCategory =
  | "normal"
  | "returned"
  | "recovery";

export type RecoveryPart =
  | 1
  | 2;

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

  fileCategory?: BankFileCategory;
  recoveryPart?: RecoveryPart | null;
  relatedFileId?: number | null;
};

export type CalendarDayData = {
  date: string;
  files: CalendarFile[];

  totalFiles: number;
  pdfCount: number;
  xmlCount: number;
  reportCount: number;

  pendingMembers: number;
  status: DayStatus;
};

export type StandardUploadFilePayload = {
  mode: "standard";

  date: string;
  type: "pdf" | "xml";
  files: File[];

  fileCategory: "normal" | "returned";
};

export type RecoveryUploadFilePayload = {
  mode: "recovery";

  date: string;

  recoveryFile1: File;
  recoveryFile2: File;
};

export type UploadFilePayload =
  | StandardUploadFilePayload
  | RecoveryUploadFilePayload;

export type ProcessingSelection = {
  date: string;
  files: CalendarFile[];
};