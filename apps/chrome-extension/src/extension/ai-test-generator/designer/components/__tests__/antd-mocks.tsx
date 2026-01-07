/**
 * Shared antd component mocks for React component tests
 * These are minimal implementations to avoid full antd dependency in tests
 */

import { vi } from 'vitest';

// Define List.Item component
const ListItem = ({ children, onClick, style }: any) => (
  <div onClick={onClick} style={style} data-testid="list-item">{children}</div>
);

// Define List.Item.Meta component
ListItem.Meta = ({ avatar, title, description }: any) => (
  <div data-testid="list-item-meta">
    {avatar && <div data-testid="list-item-avatar">{avatar}</div>}
    {title && <div data-testid="list-item-title">{title}</div>}
    {description && <div data-testid="list-item-description">{description}</div>}
  </div>
);

// Space.Compact mock
const SpaceCompactMock = ({ children, style }: any) => (
  <div data-testid="space-compact" style={style}>{children}</div>
);

// Space component
const SpaceMock = ({ children, direction, size, style }: any) => (
  <div data-testid={`space-${direction || 'horizontal'}`} style={style}>{children}</div>
);
SpaceMock.Compact = SpaceCompactMock;

// TextArea component
const TextAreaMock = ({ value, onChange, placeholder, rows, status, maxLength, showCount }: any) => (
  <div>
    <textarea
      data-testid={`textarea-${placeholder?.replace(/\s+/g, '-').toLowerCase() || 'field'}`}
      value={value || ''}
      placeholder={placeholder}
      rows={rows}
      maxLength={maxLength}
      onChange={(e) => onChange?.({ target: { value: e.target.value } })}
      className={status === 'error' ? 'input-error' : ''}
    />
    {showCount && <span data-testid="input-count">{String(value || '').length}/{maxLength}</span>}
    {status === 'error' && <span data-testid="textarea-error">error</span>}
  </div>
);

// Input component with TextArea as property
const InputMock = ({ value, onChange, placeholder, status, type = 'text', rows, maxLength, showCount, onPressEnter }: any) => {
  // Handle TextArea
  if (rows) {
    return (
      <div>
        <textarea
          data-testid={`textarea-${placeholder?.replace(/\s+/g, '-').toLowerCase() || 'field'}`}
          value={value || ''}
          placeholder={placeholder}
          rows={rows}
          maxLength={maxLength}
          onChange={(e) => onChange?.({ target: { value: e.target.value } })}
          className={status === 'error' ? 'input-error' : ''}
        />
        {showCount && <span data-testid="input-count">{String(value || '').length}/{maxLength}</span>}
        {status === 'error' && <span data-testid="textarea-error">error</span>}
      </div>
    );
  }
  return (
    <div>
      <input
        data-testid={`input-${placeholder?.replace(/\s+/g, '-').toLowerCase() || 'field'}`}
        type={type}
        value={value || ''}
        placeholder={placeholder}
        onChange={(e) => onChange?.({ target: { value: e.target.value } })}
        onKeyDown={(e) => e.key === 'Enter' && onPressEnter?.()}
        className={status === 'error' ? 'input-error' : ''}
      />
      {status === 'error' && <span data-testid="input-error">error</span>}
    </div>
  );
};

// Add TextArea as a property of Input
InputMock.TextArea = TextAreaMock;

// Helper to get a safe testid from title (which might be a React element)
const getTitleTestId = (title: any, defaultId: string) => {
  if (typeof title === 'string') {
    return `modal-${title.replace(/\s+/g, '-').toLowerCase()}`;
  }
  return `modal-${defaultId}`;
};

// Export the antd mock factory
export const antdMockFactory = () => ({
  Modal: ({ children, open, onOk, onCancel, title, footer, width }: any) =>
    open ? (
      <div data-testid={getTitleTestId(title, 'dialog')} style={{ width }}>
        <div data-testid="modal-title">{title}</div>
        {children}
        {footer && <div data-testid="modal-footer">{footer}</div>}
        <button data-testid="modal-ok" onClick={onOk}>OK</button>
        <button data-testid="modal-cancel" onClick={onCancel}>Cancel</button>
      </div>
    ) : null,
  Input: InputMock,
  'Input.TextArea': TextAreaMock,
  Select: ({ value, onChange, options, style }: any) => (
    <select
      data-testid="select-type"
      value={value || ''}
      onChange={(e) => onChange?.(e.target.value)}
      style={style}
    >
      {options?.map((opt: any) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  ),
  Button: ({ children, onClick, icon, danger, type, size, disabled, 'data-icon': dataIcon }: any) => (
    <button
      data-testid={`button-${typeof children === 'string' ? children.toLowerCase().replace(/\s+/g, '-') : dataIcon || 'button'}`}
      onClick={onClick}
      disabled={disabled}
      className={danger ? 'btn-danger' : type === 'primary' ? 'btn-primary' : 'btn-default'}
      data-size={size}
    >
      {typeof children === 'string' && children}
      {icon && <span data-testid="button-icon" data-icon={dataIcon}>{icon}</span>}
    </button>
  ),
  Space: SpaceMock,
  'Space.Compact': SpaceCompactMock,
  Table: ({ columns, dataSource, rowKey, emptyText, pagination, locale }: any) => {
    const keyAccessor = typeof rowKey === 'function' ? rowKey : (item: any) => item[rowKey];
    const hasData = dataSource && dataSource.length > 0;
    return (
      <div data-testid="table">
        <table>
          <thead>
            <tr>
              {columns?.map((col: any) => (
                <th key={col.key || col.dataIndex}>{col.title}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hasData ? (
              dataSource.map((item: any, idx: number) => (
                <tr key={keyAccessor(item, idx) || idx}>
                  {columns?.map((col: any) => (
                    <td key={col.key || col.dataIndex} data-testid={`cell-${col.key || col.dataIndex}`}>
                      {col.render ? col.render(item[col.dataIndex], item, idx) : item[col.dataIndex]}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns?.length || 1}>{locale?.emptyText || emptyText || 'No data'}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  },
  Tag: ({ children, color, icon }: any) => (
    <span data-testid={`tag-${color || 'default'}`}>
      {icon && <span data-testid="tag-icon">{icon}</span>}
      {children}
    </span>
  ),
  Tooltip: ({ children, title }: any) => {
    const titleStr = typeof title === 'string' ? title : 'tooltip';
    return (
      <div data-testid={`tooltip-${titleStr.replace(/\s+/g, '-').toLowerCase()}`} title={typeof title === 'string' ? title : undefined}>{children}</div>
    );
  },
  Spin: ({ size }: any) => (
    <span data-testid={`spin-${size || 'default'}`}>&#8987;</span>
  ),
  Card: ({ children, size }: any) => (
    <div data-testid={`card-${size || 'default'}`}>{children}</div>
  ),
  Image: ({ src, alt }: any) => (
    <img data-testid={`image-${alt || 'img'}`} src={src} alt={alt} />
  ),
  List: Object.assign(
    function ListMock({ dataSource, renderItem, size }: any) {
      return (
        <div data-testid={`list-${size || 'default'}`}>
          {dataSource?.map((item: any, idx: number) => (
            <div key={idx} data-testid={`list-item-${idx}`}>
              {renderItem(item, idx)}
            </div>
          ))}
        </div>
      );
    },
    { Item: ListItem }
  ),
  Radio: ({ checked, onChange }: any) => (
    <input
      type="radio"
      data-testid="radio-selector"
      checked={checked}
      onChange={onChange ? () => onChange({ target: { checked: true } }) : undefined}
    />
  ),
  message: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
});

// Export the icon mock factory
export const iconMockFactory = () => ({
  DeleteOutlined: () => <span data-testid="icon-delete" />,
  EditOutlined: () => <span data-testid="icon-edit" />,
  PlusOutlined: () => <span data-testid="icon-plus" />,
  VariableOutlined: () => <span data-testid="icon-variable" />,
  CheckCircleOutlined: () => <span data-testid="icon-check-circle" />,
  ExclamationCircleOutlined: () => <span data-testid="icon-exclamation" />,
  CheckOutlined: () => <span data-testid="icon-check" />,
  CloseOutlined: () => <span data-testid="icon-close" />,
  CopyOutlined: () => <span data-testid="icon-copy" />,
  ReloadOutlined: () => <span data-testid="icon-reload" />,
  CameraOutlined: () => <span data-testid="icon-camera" />,
  AimOutlined: () => <span data-testid="icon-aim" />,
});
