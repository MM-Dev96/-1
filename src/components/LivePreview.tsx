import React, { useState, useRef, useEffect } from "react";
import {
  Monitor,
  Smartphone,
  Download,
  ExternalLink,
  RefreshCw,
  Lock,
  Shield,
  Check,
  Terminal,
  FolderUp,
  MonitorPlay,
  FileUp,
  UploadCloud,
  Maximize,
  Minimize,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Copy,
  X,
  Sun,
  Moon,
  Wifi,
  File,
  Folder,
  ChevronRight,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useAppStore } from "../store";

export interface FileNode {
  name: string;
  type: "file" | "directory";
  path: string;
  children?: FileNode[];
}

const FileTreeNode = ({
  node,
  level,
  onSelect,
  selectedPath,
}: {
  node: FileNode;
  level: number;
  onSelect: (path: string) => void;
  selectedPath: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const isSelected = selectedPath === node.path;

  if (node.type === "directory") {
    return (
      <div className="select-none">
        <div
          className="flex items-center gap-1.5 py-1 px-2 hover:bg-white/5 cursor-pointer text-zinc-300 rounded-md transition-colors"
          style={{ paddingRight: `${level * 12 + 8}px` }}
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? (
            <ChevronDown size={14} className="text-zinc-500 shrink-0" />
          ) : (
            <ChevronRight size={14} className="text-zinc-500 shrink-0" />
          )}
          <Folder size={14} className="text-indigo-400 shrink-0" />
          <span className="text-sm truncate">{node.name}</span>
        </div>
        {isOpen && node.children && (
          <div className="flex flex-col">
            {node.children.map((child: FileNode, i: number) => (
              <FileTreeNode
                key={node.path}
                node={child}
                level={level + 1}
                onSelect={onSelect}
                selectedPath={selectedPath}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-1.5 py-1 px-2 cursor-pointer rounded-md transition-colors ${isSelected ? "bg-indigo-500/20 text-indigo-300" : "hover:bg-white/5 text-zinc-400"}`}
      style={{ paddingRight: `${level * 12 + 24}px` }}
      onClick={() => onSelect(node.path)}
    >
      <File
        size={14}
        className={
          isSelected ? "text-indigo-400 shrink-0" : "text-zinc-500 shrink-0"
        }
      />
      <span className="text-sm truncate">{node.name}</span>
    </div>
  );
};

export default function LivePreview() {
  const {
    mockupHtml,
    setMockupHtml,
    isGeneratingMockup,
    setIsGeneratingMockup,
    mockupError,
    setMockupError,
    mockupSimTimeLeft,
    setMockupSimTimeLeft,
    mockupSimFiles,
    setMockupSimFiles,
  } = useAppStore();

  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">(
    "desktop",
  );
  const [mobileOrientation, setMobileOrientation] = useState<
    "portrait" | "landscape"
  >("portrait");
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [iframeLoading, setIframeLoading] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const [wrapperTheme, setWrapperTheme] = useState<"dark" | "light">("dark");

  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [isFolderImport, setIsFolderImport] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const singleFileInputRef = useRef<HTMLInputElement>(null);

  // When mockupHtml changes (e.g. from app_evaluator or here), and we don't have a folder import URL
  useEffect(() => {
    if (!isFolderImport && mockupHtml) {
      setIframeLoading(true);
      const blob = new Blob([mockupHtml], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [mockupHtml, isFolderImport]);

  const handleCopyUrl = async () => {
    if (!previewUrl) return;
    try {
      const fullUrl = new URL(previewUrl, window.location.href).href;
      await navigator.clipboard.writeText(fullUrl);
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy URL", err);
    }
  };

  const handleClearPreview = () => {
    setPreviewUrl("");
    setIsFolderImport(false);
    setZoomLevel(100);
    setIframeLoading(false);
    setFileTree([]);
  };

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const items = e.clipboardData.items;
      if (!items || items.length === 0) return;
      
      const filesToUpload: { file: File; path: string }[] = [];

      const readEntry = async (entry: any, path: string = "") => {
        if (entry.isFile) {
          const file = await new Promise<File>((resolve) => entry.file(resolve));
          filesToUpload.push({ file, path: path + file.name });
        } else if (entry.isDirectory) {
          const dirReader = entry.createReader();
          let allEntries: any[] = [];

          const readEntries = async () => {
            const entries = await new Promise<any[]>((resolve) => {
              dirReader.readEntries(resolve);
            });
            if (entries.length > 0) {
              allEntries = allEntries.concat(entries);
              await readEntries();
            }
          };
          await readEntries();

          for (let i = 0; i < allEntries.length; i++) {
            await readEntry(allEntries[i], path + entry.name + "/");
          }
        }
      };

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file") {
          const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
          if (entry) {
            await readEntry(entry, "");
          } else {
            // fallback
            const file = item.getAsFile();
            if (file) {
              filesToUpload.push({ file, path: file.name });
            }
          }
        }
      }

      if (filesToUpload.length > 0) {
        setIsFolderImport(true);
        setIsUploading(true);

        const formData = new FormData();
        for (const { file, path } of filesToUpload) {
          formData.append("files", file);
          formData.append("paths", path);
        }

        try {
          const res = await fetch("/api/preview/upload", {
            method: "POST",
            body: formData,
          });
          
          if (!res.ok) {
            let errorMsg = "Failed to upload via paste";
            try {
              const errData = await res.json();
              if (errData.error) errorMsg = errData.error;
            } catch (e) {}
            throw new Error(errorMsg);
          }

          const data = await res.json();
          if (data.previewUrl) {
            setPreviewUrl(data.previewUrl);
          }
          if (data.fileTree) {
            setFileTree(data.fileTree);
          } else {
            setFileTree([]);
          }
        } catch (err: unknown) {
          console.error(err);
          alert(`فشل رفع الملفات عبر اللصق: ${(err as Error).message}`);
        } finally {
          setIsUploading(false);
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 10, 200));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 10, 20));
  const handleZoomReset = () => setZoomLevel(100);

  const handleSingleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsFolderImport(true);
    setIsUploading(true);

    const formData = new FormData();
    formData.append("files", files[0]);
    formData.append("paths", files[0].name);

    try {
      const res = await fetch("/api/preview/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        let errorMsg = "Failed to upload file";
        try {
          const errData = await res.json();
          if (errData.error) errorMsg = errData.error;
        } catch (e) {}
        throw new Error(errorMsg);
      }

      const data = await res.json();
      if (data.previewUrl) {
        setPreviewUrl(data.previewUrl);
      }
      if (data.fileTree) {
        setFileTree(data.fileTree);
      } else {
        setFileTree([]);
      }
    } catch (err: unknown) {
      console.error(err);
      alert(`فشل رفع الملف: ${(err as Error).message}`);
    } finally {
      setIsUploading(false);
    }
  };

  interface CustomInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  webkitdirectory?: string;
}

const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsFolderImport(true);
    setIsUploading(true);

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
      formData.append("paths", files[i].webkitRelativePath);
    }

    try {
      const res = await fetch("/api/preview/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        let errorMsg = "Failed to upload folder";
        try {
          const errData = await res.json();
          if (errData.error) errorMsg = errData.error;
        } catch (e) {}
        throw new Error(errorMsg);
      }

      const data = await res.json();
      if (data.previewUrl) {
        setPreviewUrl(data.previewUrl);
      }
      if (data.fileTree) {
        setFileTree(data.fileTree);
      } else {
        setFileTree([]);
      }
    } catch (err: unknown) {
      console.error(err);
      alert(`فشل استيراد المجلد: ${(err as Error).message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const items = e.dataTransfer.items;
    if (!items || items.length === 0) return;

    setIsUploading(true);
    const filesToUpload: { file: File; path: string }[] = [];

    const readEntry = async (entry: any, path: string = "") => {
      if (entry.isFile) {
        const file = await new Promise<File>((resolve) => entry.file(resolve));
        filesToUpload.push({ file, path: path + file.name });
      } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        let allEntries: any[] = [];

        const readEntries = async () => {
          const entries = await new Promise<any[]>((resolve) => {
            dirReader.readEntries(resolve);
          });
          if (entries.length > 0) {
            allEntries = allEntries.concat(entries);
            await readEntries();
          }
        };
        await readEntries();

        for (let i = 0; i < allEntries.length; i++) {
          await readEntry(allEntries[i], path + entry.name + "/");
        }
      }
    };

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file") {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          await readEntry(entry, "");
        }
      }
    }

    if (filesToUpload.length === 0) {
      setIsUploading(false);
      return;
    }

    setIsFolderImport(true);
    const formData = new FormData();
    for (const { file, path } of filesToUpload) {
      formData.append("files", file);
      formData.append("paths", path);
    }

    try {
      const res = await fetch("/api/preview/upload", {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) {
        let errorMsg = "Failed to upload via drag & drop";
        try {
          const errData = await res.json();
          if (errData.error) errorMsg = errData.error;
        } catch (e) {}
        throw new Error(errorMsg);
      }

      const data = await res.json();
      if (data.previewUrl) {
        setPreviewUrl(data.previewUrl);
      }
      if (data.fileTree) {
        setFileTree(data.fileTree);
      } else {
        setFileTree([]);
      }
    } catch (err: unknown) {
      console.error(err);
      alert(`فشل رفع الملفات عبر السحب والإفلات: ${(err as Error).message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in duration-300 h-[calc(100vh-140px)] flex flex-col">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white mb-2">
            المعاينة الحية
          </h2>
          <p className="text-zinc-400 text-sm">
            قم بمعاينة مشاريعك وتطبيقاتك بشكل مباشر، يمكنك أيضاً استيراد مجلد
            كامل لرفعه وتجربته هنا.
          </p>
        </div>
        <div className="flex gap-3">
          <input
            type="file"
            accept=".zip,.html"
            ref={singleFileInputRef}
            className="hidden"
            onChange={handleSingleFileUpload}
          />
          <button aria-label="button" 
            onClick={() => singleFileInputRef.current?.click()}
            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <FileUp size={16} /> رفع ملف (ZIP أو HTML)
          </button>
          {/* Folder upload uses webkitdirectory */}
          <input
            type="file"
            {...( { webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement> & { webkitdirectory?: string; directory?: string } )}
            multiple
            ref={fileInputRef}
            className="hidden"
            onChange={handleFolderUpload}
          />
          <button aria-label="button" 
            onClick={() => fileInputRef.current?.click()}
            className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <FolderUp size={16} /> استيراد مجلد مشروع
          </button>
        </div>
      </div>

      <div
        className={
          isFullscreen
            ? "fixed inset-0 z-50 flex flex-col"
            : "flex-1 w-full relative rounded-2xl overflow-hidden flex flex-col border border-white/10 shadow-2xl"
        }
      >
        {/* Browser Header / Toolbar */}
        <div className="bg-[#1a1a1a] px-4 py-3 flex items-center gap-4 border-b border-white/5 flex-wrap">
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={handleClearPreview}
              className="w-3 h-3 rounded-full bg-rose-500/80 hover:bg-rose-500 flex items-center justify-center group"
              title="إغلاق المعاينة"
            >
              <X
                size={8}
                className="opacity-0 group-hover:opacity-100 text-black/50"
              />
            </button>
            <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
          </div>
          <div className="flex gap-2 text-zinc-400 shrink-0">
            <button aria-label="button" 
              className="p-1.5 hover:bg-white/5 hover:text-white rounded transition-colors"
              onClick={() => {
                if (!isFolderImport && mockupHtml) {
                  setIframeLoading(true);
                  const blob = new Blob([mockupHtml], { type: "text/html" });
                  setPreviewUrl(URL.createObjectURL(blob));
                } else if (isFolderImport) {
                  setIframeLoading(true);
                  const iframe = document.getElementById(
                    "preview-iframe",
                  ) as HTMLIFrameElement;
                  if (iframe) iframe.src = iframe.src;
                }
              }}
              title="إعادة تحميل"
            >
              <RefreshCw
                size={14}
                className={iframeLoading ? "animate-spin" : ""}
              />
            </button>
            {fileTree.length > 0 && (
              <button aria-label="button" 
                className={`p-1.5 rounded transition-colors ${isSidebarOpen ? "bg-white/10 text-white" : "hover:bg-white/5 hover:text-white"}`}
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                title="إظهار/إخفاء ملفات المشروع"
              >
                {isSidebarOpen ? (
                  <PanelLeftClose size={14} />
                ) : (
                  <PanelLeftOpen size={14} />
                )}
              </button>
            )}
          </div>

          <div className="flex-1 min-w-[200px] bg-black/50 rounded-md px-3 py-1.5 text-xs text-zinc-500 font-mono text-center border border-white/5 flex items-center justify-between gap-2 relative group overflow-hidden">
            <div className="flex items-center gap-2" title="متصل">
              <Wifi size={10} className="text-emerald-500/70" />
              <Lock size={10} className="text-zinc-600" />
              <span className="truncate max-w-[250px]">
                {isFolderImport
                  ? new URL(previewUrl, window.location.href).pathname
                  : "app.preview.local"}
              </span>
            </div>
            {previewUrl && (
              <button
                onClick={handleCopyUrl}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-white hover:bg-white/10 rounded"
                title="نسخ الرابط"
              >
                {urlCopied ? (
                  <Check size={12} className="text-emerald-500" />
                ) : (
                  <Copy size={12} />
                )}
              </button>
            )}
          </div>

          {/* Zoom Controls */}
          {previewUrl && (
            <div className="flex gap-1 bg-black/40 p-1 rounded-lg border border-white/5 shrink-0 items-center">
              <button
                onClick={handleZoomOut}
                className="p-1 text-zinc-500 hover:text-white rounded"
                title="تصغير"
              >
                <ZoomOut size={14} />
              </button>
              <button
                onClick={handleZoomReset}
                className="px-2 text-xs text-zinc-400 font-mono w-12 hover:text-white"
                title="إعادة تعيين التكبير"
              >
                {zoomLevel}%
              </button>
              <button
                onClick={handleZoomIn}
                className="p-1 text-zinc-500 hover:text-white rounded"
                title="تكبير"
              >
                <ZoomIn size={14} />
              </button>
            </div>
          )}

          <div className="flex gap-1 bg-black/40 p-1 rounded-lg border border-white/5 shrink-0">
            <button aria-label="button" 
              className={`p-1.5 rounded-md transition-all ${previewDevice === "desktop" ? "bg-white/10 text-white shadow-sm" : "text-zinc-500 hover:text-white"}`}
              onClick={() => setPreviewDevice("desktop")}
              title="عرض سطح المكتب"
            >
              <Monitor size={14} />
            </button>
            <button aria-label="button" 
              className={`p-1.5 rounded-md transition-all ${previewDevice === "mobile" ? "bg-white/10 text-white shadow-sm" : "text-zinc-500 hover:text-white"}`}
              onClick={() => setPreviewDevice("mobile")}
              title="عرض الهاتف"
            >
              <Smartphone size={14} />
            </button>
            {previewDevice === "mobile" && (
              <button aria-label="button" 
                className="p-1.5 rounded-md text-zinc-500 hover:text-white transition-all ml-1 border-l border-white/10 pl-2"
                onClick={() =>
                  setMobileOrientation((prev) =>
                    prev === "portrait" ? "landscape" : "portrait",
                  )
                }
                title="تدوير الشاشة"
              >
                <RotateCw size={14} />
              </button>
            )}
          </div>
          <div className="flex gap-2 pl-2 border-l border-white/10 shrink-0">
            <button aria-label="button" 
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/5 rounded transition-colors"
              onClick={() =>
                setWrapperTheme((prev) => (prev === "dark" ? "light" : "dark"))
              }
              title={
                wrapperTheme === "dark"
                  ? "وضع نهاري للخلفية"
                  : "وضع ليلي للخلفية"
              }
            >
              {wrapperTheme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            {!isFolderImport && (
              <button aria-label="button" 
                className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/5 rounded transition-colors"
                onClick={() => {
                  const blob = new Blob([mockupHtml], { type: "text/html" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "prototype.html";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                title="تحميل كود المصدر"
              >
                <Download size={14} />
              </button>
            )}
            <button aria-label="button" 
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/5 rounded transition-colors"
              onClick={() => {
                window.open(previewUrl, "_blank");
              }}
              title="فتح في نافذة جديدة"
            >
              <ExternalLink size={14} />
            </button>
            <button aria-label="button" 
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/5 rounded transition-colors"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? "تصغير" : "تكبير الشاشة"}
            >
              {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
            </button>
          </div>
        </div>

        <div className="flex-1 w-full flex overflow-hidden">
          {/* Sidebar */}
          {fileTree.length > 0 && isSidebarOpen && (
            <div className="w-64 bg-[#111] border-l border-white/10 flex flex-col shrink-0 custom-scrollbar overflow-y-auto">
              <div className="p-3 text-xs font-medium text-zinc-400 uppercase tracking-wider border-b border-white/5 sticky top-0 bg-[#111] z-10 flex items-center justify-between">
                <span>ملفات المشروع</span>
                <button aria-label="button" 
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1 hover:bg-white/10 rounded transition-colors text-zinc-500 hover:text-white"
                >
                  <PanelLeftClose size={14} />
                </button>
              </div>
              <div className="p-2 space-y-0.5" dir="ltr">
                {fileTree.map((node: FileNode, i: number) => (
                  <FileTreeNode
                    key={node.path}
                    node={node}
                    level={0}
                    onSelect={(path) => {
                      const rootPreviewUrl =
                        previewUrl.substring(
                          0,
                          previewUrl.lastIndexOf("/previews/"),
                        ) +
                        "/previews/" +
                        previewUrl.split("/previews/")[1].split("/")[0];
                      setPreviewUrl(rootPreviewUrl + path);
                      setIframeLoading(true);
                    }}
                    selectedPath={
                      previewUrl
                        .split("/previews/")[1]
                        ?.split("/")
                        .slice(1)
                        .join("/")
                        ? "/" +
                          previewUrl
                            .split("/previews/")[1]
                            ?.split("/")
                            .slice(1)
                            .join("/")
                        : ""
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/* Main Preview Area */}
          <div
            className={`flex-1 flex items-start justify-center overflow-auto custom-scrollbar p-6 relative ${isDragging ? "ring-2 ring-indigo-500/50 bg-indigo-500/5" : ""} ${wrapperTheme === "dark" ? "bg-[#0a0a0a]" : "bg-zinc-100"}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {wrapperTheme === "dark" && (
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
            )}
            {wrapperTheme === "light" && (
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#0000000a_1px,transparent_1px),linear-gradient(to_bottom,#0000000a_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
            )}

            {isUploading ? (
              <div className="relative flex flex-col items-center justify-center text-center z-10 bg-black/60 backdrop-blur-sm p-8 rounded-2xl border border-white/10 mt-20">
                <div className="animate-spin rounded-full h-12 w-12 border-2 border-white/10 border-t-indigo-500 mb-6"></div>
                <h3 className="text-xl font-medium text-white mb-2">
                  جاري رفع الملفات...
                </h3>
                <p className="text-zinc-400 text-sm">
                  يرجى الانتظار بينما يتم معالجة ونشر ملفات المشروع.
                </p>
              </div>
            ) : isDragging ? (
              <div className="relative flex flex-col items-center justify-center text-center z-10 bg-indigo-500/10 border border-indigo-500/30 p-12 rounded-3xl animate-pulse mt-20">
                <UploadCloud size={48} className="text-indigo-400 mb-4" />
                <h3 className="text-xl font-medium text-white mb-2">
                  أفلت المجلد هنا
                </h3>
                <p className="text-indigo-200/70">
                  قم بإفلات المجلد لرفعه وتشغيله مباشرة
                </p>
              </div>
            ) : previewUrl ? (
              <div
                style={{
                  transform: `scale(${zoomLevel / 100})`,
                  transformOrigin: "top center",
                }}
                className={`transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] relative bg-white shadow-2xl ${
                  previewDevice === "mobile"
                    ? (mobileOrientation === "portrait"
                        ? "w-[375px] h-[812px]"
                        : "w-[812px] h-[375px]") +
                      " rounded-[2.5rem] border-[12px] border-[#1a1a1a] shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_20px_40px_rgba(0,0,0,0.5)]"
                    : "w-full min-h-full rounded-lg border border-zinc-200/20"
                }`}
              >
                {previewDevice === "mobile" && (
                  <>
                    <div
                      className={`absolute ${mobileOrientation === "portrait" ? "top-0 left-1/2 -translate-x-1/2 w-32 h-6 rounded-b-3xl" : "left-0 top-1/2 -translate-y-1/2 h-32 w-6 rounded-r-3xl"} bg-[#1a1a1a] z-20 pointer-events-none`}
                    ></div>
                    <div
                      className={`absolute ${mobileOrientation === "portrait" ? "bottom-1.5 left-1/2 -translate-x-1/2 w-32 h-1.5" : "right-1.5 top-1/2 -translate-y-1/2 h-32 w-1.5"} bg-black/20 rounded-full z-20 pointer-events-none`}
                    ></div>
                  </>
                )}
                {iframeLoading && (
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-3">
                    <div className="w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                    <span className="text-zinc-500 text-sm font-medium">جاري تحميل المعاينة...</span>
                  </div>
                )}
                {iframeError && (
                  <div className="absolute inset-0 bg-red-50/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-3">
                    <div className="text-red-500 mb-2">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    </div>
                    <span className="text-red-600 text-sm font-medium">فشل تحميل المعاينة</span>
                    <button aria-label="button" onClick={() => {
                      setIframeLoading(true);
                      setIframeError(false);
                      const iframe = document.getElementById('preview-iframe') as HTMLIFrameElement;
                      if (iframe) iframe.src = iframe.src;
                    }} className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-medium transition-colors">إعادة المحاولة</button>
                  </div>
                )}
                <iframe
                  id="preview-iframe"
                  src={previewUrl}
                  onLoad={() => {
                    setIframeLoading(false);
                    setIframeError(false);
                  }}
                  onError={() => {
                    setIframeLoading(false);
                    setIframeError(true);
                    // auto retry after 3 seconds
                    setTimeout(() => {
                       setIframeLoading(true);
                       setIframeError(false);
                       const iframe = document.getElementById('preview-iframe') as HTMLIFrameElement;
                       if (iframe) iframe.src = iframe.src;
                    }, 3000);
                  }}
                  className="w-full h-full border-0 bg-white rounded-[1.5rem]"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
                  title="App Mockup"
                />
              </div>
            ) : (
              <div className="relative flex flex-col items-center justify-center text-center z-10">
                <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-4 border border-white/10">
                  <MonitorPlay size={32} className="text-zinc-500" />
                </div>
                <h3 className="text-xl font-medium text-white mb-2">
                  لا يوجد مشروع للمعاينة
                </h3>
                <p className="text-zinc-400 max-w-sm mb-6">
                  قم باستيراد ملف ZIP أو مجلد مشروع من جهازك لمعاينته هنا.
                </p>
                <div className="flex gap-3">
                  <button aria-label="button" 
                    onClick={() => singleFileInputRef.current?.click()}
                    className="bg-indigo-500 hover:bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    <FileUp size={16} /> رفع ملف (ZIP أو HTML)
                  </button>
                  <button aria-label="button" 
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-white/10 hover:bg-white/15 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    <FolderUp size={16} /> استيراد مجلد
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
