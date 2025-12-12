import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { FileText, Trash2, Upload, X } from 'lucide-react';

interface ProjectFile {
  id: string;
  name: string;
  type: string;
  size: number;
}

interface AddFileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAddFiles: (files: ProjectFile[]) => void;
  existingFiles: ProjectFile[];
}

export function AddFileDialog({ isOpen, onClose, onAddFiles, existingFiles }: AddFileDialogProps) {
  const [files, setFiles] = useState<ProjectFile[]>(existingFiles);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles) {
      const newFiles: ProjectFile[] = Array.from(selectedFiles).map((file) => ({
        id: `${Date.now()}-${Math.random()}`,
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
      }));
      setFiles([...files, ...newFiles]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles) {
      const newFiles: ProjectFile[] = Array.from(droppedFiles).map((file) => ({
        id: `${Date.now()}-${Math.random()}`,
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
      }));
      setFiles([...files, ...newFiles]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleRemoveFile = (id: string) => {
    setFiles(files.filter(file => file.id !== id));
  };

  const handleSave = () => {
    onAddFiles(files);
    onClose();
  };

  const handleClose = () => {
    setFiles(existingFiles);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>프로젝트 파일</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSave}
              className="text-sm"
            >
              파일 추가
            </Button>
          </DialogTitle>
          <DialogDescription>
            프로젝트 내에서 채팅할 때 text와 같은 컨텍스트에 대상으로 쓰입니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-2 mb-4">
              {files.map((file) => (
                <FileItem
                  key={file.id}
                  file={file}
                  onRemove={handleRemoveFile}
                />
              ))}
            </div>
          )}

          {/* Upload Area */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 bg-white'
            }`}
          >
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <Upload className="size-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600 mb-2">
                문서, 코드 파일, 이미지 등을 추가해보세요. 프로젝트 내에서 채팅할 때
              </p>
              <p className="text-gray-600">
                text와 같은 컨텍스트에 대상으로 쓰입니다.
              </p>
            </label>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface FileItemProps {
  file: ProjectFile;
  onRemove: (id: string) => void;
}

function FileItem({ file, onRemove }: FileItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  const getFileIcon = () => {
    if (file.type.includes('pdf')) {
      return (
        <div className="size-10 rounded bg-red-500 flex items-center justify-center flex-shrink-0">
          <FileText className="size-5 text-white" />
        </div>
      );
    }
    return (
      <div className="size-10 rounded bg-gray-500 flex items-center justify-center flex-shrink-0">
        <FileText className="size-5 text-white" />
      </div>
    );
  };

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {getFileIcon()}
      <div className="flex-1 min-w-0">
        <p className="truncate">{file.name}</p>
        <p className="text-xs text-gray-500">PDF</p>
      </div>
      {isHovered && (
        <button
          onClick={() => onRemove(file.id)}
          className="p-2 hover:bg-gray-200 rounded-lg transition-colors flex-shrink-0"
        >
          <Trash2 className="size-4 text-gray-600" />
        </button>
      )}
    </div>
  );
}