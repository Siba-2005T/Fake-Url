/**
 * ImageUpload.jsx - Component Upload Ảnh Thumbnail
 * ==================================================
 * Cho phép người dùng kéo thả hoặc chọn ảnh từ máy tính.
 * Hiển thị preview ảnh ngay sau khi chọn.
 * Ảnh sẽ được upload lên Cloudinary ở phía Backend.
 * Hỗ trợ: PNG, JPG, JPEG, GIF, WEBP (tối đa 10MB)
 */
import { useState, useRef, useCallback } from 'react';
import { Upload, X, Image as ImageIcon, Check, Cloud } from 'lucide-react';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

const ImageUpload = ({ value, onChange, existingImageUrl }) => {
  // Trạng thái kéo thả
  const [isDragging, setIsDragging] = useState(false);
  // Lỗi validation
  const [error, setError] = useState('');
  // Preview URL của ảnh vừa chọn (dạng blob URL hoặc URL Cloudinary hiện tại)
  const [previewUrl, setPreviewUrl] = useState(existingImageUrl || null);
  // Có phải ảnh từ cloud (Cloudinary) không
  const [isCloudImage, setIsCloudImage] = useState(
    Boolean(existingImageUrl && existingImageUrl.startsWith('http'))
  );

  const fileInputRef = useRef(null);

  /**
   * Xử lý khi người dùng chọn/thả file
   * 1. Validate loại file và kích thước
   * 2. Tạo preview URL bằng URL.createObjectURL
   * 3. Gọi onChange để truyền File lên component cha (gửi qua FormData)
   * Lưu ý: File thực sự được upload lên Cloudinary ở Backend,
   *        không phải ở đây. Frontend chỉ hiển thị preview.
   */
  const handleFile = useCallback((file) => {
    setError('');

    // Kiểm tra loại file
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Chỉ chấp nhận file ảnh: PNG, JPG, GIF, WEBP');
      return;
    }

    // Kiểm tra kích thước file
    if (file.size > MAX_SIZE_BYTES) {
      setError(`File quá lớn. Tối đa ${MAX_SIZE_MB}MB.`);
      return;
    }

    // Tạo preview URL cục bộ (blob URL tạm thời, không phải cloud URL)
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setIsCloudImage(false); // Đây là file local chờ upload

    // Truyền File object lên component cha (để đưa vào FormData gửi API)
    onChange(file);
  }, [onChange]);

  // --- Drag & Drop handlers ---
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  // --- Input file handler ---
  const handleInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input để có thể chọn lại cùng file
    e.target.value = '';
  };

  // --- Xóa ảnh đã chọn ---
  const handleRemove = () => {
    // Giải phóng blob URL để tránh memory leak
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setIsCloudImage(false);
    setError('');
    onChange(null);
  };

  return (
    <div className="image-upload-wrapper">
      {/* Hiển thị preview nếu đã có ảnh */}
      {previewUrl ? (
        <div className="image-preview-container">
          <img
            src={previewUrl}
            alt="Thumbnail preview"
            className="image-preview"
          />
          <div className="image-preview-overlay">
            <div className="image-preview-actions">
              {/* Nút thay ảnh */}
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={14} />
                Thay ảnh
              </button>
              {/* Nút xóa ảnh */}
              <button
                type="button"
                className="btn btn-sm btn-danger"
                onClick={handleRemove}
              >
                <X size={14} />
                Xóa
              </button>
            </div>
          </div>

          {/* Badge trạng thái ảnh */}
          {isCloudImage ? (
            <div className="image-selected-badge image-cloud-badge">
              <Cloud size={12} />
              <span>Cloudinary</span>
            </div>
          ) : (
            <div className="image-selected-badge">
              <Check size={12} />
              <span>Chờ upload</span>
            </div>
          )}

          {/* Thông tin file (chỉ hiển thị khi chọn file mới) */}
          {value instanceof File && (
            <div className="image-file-info">
              <span className="file-name">{value.name}</span>
              <span className="file-size">
                {(value.size / 1024 / 1024).toFixed(2)} MB
              </span>
            </div>
          )}
        </div>
      ) : (
        /* Khu vực kéo thả / click chọn ảnh */
        <div
          className={`upload-dropzone ${isDragging ? 'dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          aria-label="Chọn hoặc kéo thả ảnh thumbnail"
        >
          <div className="upload-icon-wrap">
            <ImageIcon size={32} className="upload-icon" />
          </div>
          <p className="upload-text">
            <strong>Kéo thả ảnh vào đây</strong>
            <span> hoặc </span>
            <span className="upload-browse">click để chọn</span>
          </p>
          <p className="upload-hint">
            PNG, JPG, GIF, WEBP • Tối đa {MAX_SIZE_MB}MB
          </p>
          <p className="upload-hint upload-hint-og">
            💡 Khuyến nghị: 1200×630px để hiển thị đẹp trên Facebook
          </p>
          <p className="upload-hint" style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
            <Cloud size={12} style={{ opacity: 0.6 }} />
            <span style={{ opacity: 0.6 }}>Ảnh sẽ được lưu trên Cloudinary</span>
          </p>
        </div>
      )}

      {/* Thông báo lỗi */}
      {error && (
        <p className="form-error">
          <X size={12} />
          {error}
        </p>
      )}

      {/* Input file ẩn (được trigger bởi click) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        onChange={handleInputChange}
        style={{ display: 'none' }}
        aria-hidden="true"
      />
    </div>
  );
};

export default ImageUpload;
