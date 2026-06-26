"use client";

import type {
  DocumentDetails,
  DocumentListResponse,
  KnowledgeBaseDetails,
  KnowledgeBaseListResponse,
  KnowledgeBaseStatus,
  ProcessingStatus,
  UploadStatus,
} from "@ai-agent-platform/types";
import { create } from "zustand";

export type UploadState = "idle" | "ready" | "uploading" | "success" | "error";

interface KnowledgeBaseState {
  knowledgeBases: KnowledgeBaseListResponse | null;
  selectedKnowledgeBase: KnowledgeBaseDetails | null;
  documents: DocumentListResponse | null;
  selectedDocument: DocumentDetails | null;
  page: number;
  limit: number;
  search: string;
  status: KnowledgeBaseStatus | "ALL";
  documentPage: number;
  documentLimit: number;
  documentSearch: string;
  uploadStatus: UploadStatus | "ALL";
  processingStatus: ProcessingStatus | "ALL";
  uploadProgress: number;
  uploadState: UploadState;
  uploadError: string | null;
  setKnowledgeBases: (knowledgeBases: KnowledgeBaseListResponse) => void;
  setSelectedKnowledgeBase: (knowledgeBase: KnowledgeBaseDetails | null) => void;
  setDocuments: (documents: DocumentListResponse) => void;
  setSelectedDocument: (document: DocumentDetails | null) => void;
  setPage: (page: number) => void;
  setSearch: (search: string) => void;
  setStatus: (status: KnowledgeBaseStatus | "ALL") => void;
  setDocumentPage: (page: number) => void;
  setDocumentSearch: (search: string) => void;
  setUploadStatus: (status: UploadStatus | "ALL") => void;
  setProcessingStatus: (status: ProcessingStatus | "ALL") => void;
  setUploadProgress: (progress: number) => void;
  setUploadState: (state: UploadState) => void;
  setUploadError: (error: string | null) => void;
  resetUpload: () => void;
}

export const useKnowledgeBaseStore = create<KnowledgeBaseState>((set) => ({
  knowledgeBases: null,
  selectedKnowledgeBase: null,
  documents: null,
  selectedDocument: null,
  page: 1,
  limit: 10,
  search: "",
  status: "ALL",
  documentPage: 1,
  documentLimit: 10,
  documentSearch: "",
  uploadStatus: "ALL",
  processingStatus: "ALL",
  uploadProgress: 0,
  uploadState: "idle",
  uploadError: null,
  setKnowledgeBases: (knowledgeBases) => set({ knowledgeBases }),
  setSelectedKnowledgeBase: (selectedKnowledgeBase) => set({ selectedKnowledgeBase }),
  setDocuments: (documents) => set({ documents }),
  setSelectedDocument: (selectedDocument) => set({ selectedDocument }),
  setPage: (page) => set({ page }),
  setSearch: (search) => set({ search, page: 1 }),
  setStatus: (status) => set({ status, page: 1 }),
  setDocumentPage: (documentPage) => set({ documentPage }),
  setDocumentSearch: (documentSearch) => set({ documentSearch, documentPage: 1 }),
  setUploadStatus: (uploadStatus) => set({ uploadStatus, documentPage: 1 }),
  setProcessingStatus: (processingStatus) => set({ processingStatus, documentPage: 1 }),
  setUploadProgress: (uploadProgress) => set({ uploadProgress }),
  setUploadState: (uploadState) => set({ uploadState }),
  setUploadError: (uploadError) => set({ uploadError }),
  resetUpload: () => set({ uploadProgress: 0, uploadState: "idle", uploadError: null }),
}));
