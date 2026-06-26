"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, RotateCcw, Upload, X } from "lucide-react";
import type React from "react";
import { useRef, useState } from "react";
import { Button, cn } from "@ai-agent-platform/ui";
import { formatFileSize } from "@/lib/knowledge-base-options";
import { authApi } from "@/lib/auth-api";
import { useKnowledgeBaseStore } from "@/store/knowledge-base-store";

const PDF_MIME_TYPE = "application/pdf";
const MAX_PDF_SIZE_BYTES = 25 * 1024 * 1024;

export function PdfUploadDropzone({
  knowledgeBaseId,
  onUploaded,
}: {
  knowledgeBaseId: string;
  onUploaded?: () => void;
}) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const uploadProgress = useKnowledgeBaseStore((state) => state.uploadProgress);
  const uploadState = useKnowledgeBaseStore((state) => state.uploadState);
  const uploadError = useKnowledgeBaseStore((state) => state.uploadError);
  const setUploadProgress = useKnowledgeBaseStore((state) => state.setUploadProgress);
  const setUploadState = useKnowledgeBaseStore((state) => state.setUploadState);
  const setUploadError = useKnowledgeBaseStore((state) => state.setUploadError);
  const resetUpload = useKnowledgeBaseStore((state) => state.resetUpload);

  const uploadPdf = useMutation({
    mutationFn: () => {
      if (!file) {
        throw new Error("Select a PDF before uploading.");
      }

      setUploadState("uploading");
      setUploadError(null);
      setUploadProgress(0);

      return authApi.uploadPdf({
        knowledgeBaseId,
        file,
        description: description.trim() || undefined,
        onProgress: setUploadProgress,
      });
    },
    onSuccess: () => {
      setUploadState("success");
      setFile(null);
      setDescription("");
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      void queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
      onUploaded?.();
    },
    onError: (error) => {
      setUploadState("error");
      setUploadError(error instanceof Error ? error.message : "Upload failed.");
    },
  });

  function selectFile(candidate?: File | null) {
    if (!candidate) {
      return;
    }

    const validationError = validatePdf(candidate);
    if (validationError) {
      setFile(null);
      setUploadState("error");
      setUploadError(validationError);
      setUploadProgress(0);
      return;
    }

    setFile(candidate);
    setUploadState("ready");
    setUploadError(null);
    setUploadProgress(0);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    selectFile(event.dataTransfer.files.item(0));
  }

  function clearFile() {
    setFile(null);
    setDescription("");
    resetUpload();
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  return (
    <section className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Upload PDF</h2>
          <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            Add PDF files to this knowledge base. Processing and retrieval are prepared for later.
          </p>
        </div>
        {uploadState === "error" && file ? (
          <Button variant="outline" size="sm" onClick={() => uploadPdf.mutate()}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Retry
          </Button>
        ) : null}
      </div>

      <div
        className={cn(
          "mt-5 flex min-h-48 flex-col items-center justify-center rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-6 py-8 text-center transition-colors dark:border-zinc-800 dark:bg-zinc-900/30",
          uploadState === "error" &&
            "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/20",
        )}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          className="hidden"
          type="file"
          accept="application/pdf,.pdf"
          onChange={(event) => selectFile(event.target.files?.item(0))}
        />
        <span className="flex h-12 w-12 items-center justify-center rounded-md bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
          <Upload className="h-5 w-5" aria-hidden="true" />
        </span>
        <p className="mt-4 text-sm font-medium">Drop a PDF here</p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Maximum file size 25 MB</p>
        <Button className="mt-5" variant="outline" onClick={() => inputRef.current?.click()}>
          Browse Files
        </Button>
      </div>

      {file ? (
        <div className="mt-5 rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                <FileText className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {formatFileSize(file.size)}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={clearFile}>
              <X className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Remove file</span>
            </Button>
          </div>
          <label className="mt-4 block text-sm font-medium">
            <span className="mb-2 block">Description</span>
            <textarea
              className="min-h-24 w-full resize-y rounded-md border border-zinc-200 bg-white px-3 py-3 text-sm leading-6 outline-none focus:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
              placeholder="What this PDF contains"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          {uploadState === "uploading" || uploadProgress > 0 ? (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
                <span>{uploadState === "success" ? "Uploaded" : "Uploading"}</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
                <div
                  className="h-full rounded-full bg-teal-600 transition-[width]"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : null}
          <div className="mt-5 flex justify-end">
            <Button
              onClick={() => uploadPdf.mutate()}
              disabled={uploadPdf.isPending || uploadState === "uploading"}
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              {uploadPdf.isPending || uploadState === "uploading" ? "Uploading..." : "Upload PDF"}
            </Button>
          </div>
        </div>
      ) : null}

      {uploadError ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {uploadError}
        </div>
      ) : null}

      {uploadState === "success" ? (
        <div className="mt-4 rounded-md border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-700 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-300">
          PDF uploaded successfully.
        </div>
      ) : null}
    </section>
  );
}

function validatePdf(file: File): string | null {
  if (file.size <= 0) {
    return "Uploaded PDF is empty.";
  }

  if (file.size > MAX_PDF_SIZE_BYTES) {
    return "PDF must be 25 MB or smaller.";
  }

  if (file.type !== PDF_MIME_TYPE) {
    return "Only PDF files are supported.";
  }

  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return "Uploaded file must use a .pdf extension.";
  }

  return null;
}
