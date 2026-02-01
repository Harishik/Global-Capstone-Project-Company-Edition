import { useState } from "react";
import { File, Trash2, Clock, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { StatusBadge } from "@/components/ui/status-badge";

export interface IngestedDocument {
  id: string;
  filename: string;
  size: number;
  chunks: number;
  ingestedAt: Date;
  status: "ready" | "processing" | "error";
}

interface DocumentHistoryProps {
  documents: IngestedDocument[];
  onDelete: (id: string) => void;
  isLoading?: boolean;
}

export function DocumentHistory({
  documents,
  onDelete,
  isLoading,
}: DocumentHistoryProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await onDelete(id);
    setDeletingId(null);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();
    return (
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-lg ${
          ext === "pdf"
            ? "bg-destructive/10"
            : ext === "docx"
            ? "bg-primary/10"
            : "bg-muted"
        }`}
      >
        <File
          className={`h-4 w-4 ${
            ext === "pdf"
              ? "text-destructive"
              : ext === "docx"
              ? "text-primary"
              : "text-muted-foreground"
          }`}
        />
      </div>
    );
  };

  return (
    <Card className="shadow-soft">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between text-base font-medium">
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Document History
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {documents.length} document{documents.length !== 1 ? "s" : ""}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : documents.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-dashed border-border">
            <File className="mb-2 h-6 w-6 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              No documents ingested yet
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="group flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/50"
              >
                {getFileIcon(doc.filename)}

                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {doc.filename}
                  </p>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{formatFileSize(doc.size)}</span>
                    <span className="flex items-center gap-1">
                      <Hash className="h-3 w-3" />
                      {doc.chunks} chunks
                    </span>
                    <span>{formatDate(doc.ingestedAt)}</span>
                  </div>
                </div>

                <StatusBadge
                  variant={
                    doc.status === "ready"
                      ? "success"
                      : doc.status === "processing"
                      ? "active"
                      : "error"
                  }
                  className="capitalize"
                >
                  {doc.status}
                </StatusBadge>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                      disabled={deletingId === doc.id}
                    >
                      {deletingId === doc.id ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-destructive border-t-transparent" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Document</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete "{doc.filename}"? This
                        will remove the document and all associated chunks from
                        the knowledge base. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(doc.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
