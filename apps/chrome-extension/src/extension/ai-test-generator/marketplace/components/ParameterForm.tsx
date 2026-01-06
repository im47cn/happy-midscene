/**
 * Parameter Form Component
 * Dynamic form for configuring template parameters
 */

import {
  EyeInvisibleOutlined,
  EyeOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { Form, Input, InputNumber, Select, Switch, Tooltip } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { ParameterDef } from '../types';

const { Option } = Select;

interface ParameterFormProps {
  parameters: ParameterDef[];
  values: Record<string, unknown>;
  errors?: Record<string, string>;
  onChange: (values: Record<string, unknown>) => void;
  disabled?: boolean;
}

export const ParameterForm: React.FC<ParameterFormProps> = ({
  parameters,
  values,
  errors = {},
  onChange,
  disabled = false,
}) => {
  const [form] = Form.useForm();
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>(
    {},
  );

  // Sync form values with props
  useEffect(() => {
    form.setFieldsValue(values);
  }, [form, values]);

  const handleValuesChange = useCallback(
    (_: unknown, allValues: Record<string, unknown>) => {
      onChange(allValues);
    },
    [onChange],
  );

  const togglePasswordVisibility = (name: string) => {
    setShowPasswords((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const renderField = (param: ParameterDef) => {
    const commonProps = {
      disabled,
      placeholder: param.placeholder,
    };

    switch (param.type) {
      case 'number':
        return (
          <InputNumber
            {...commonProps}
            min={param.validation?.min}
            max={param.validation?.max}
            style={{ width: '100%' }}
          />
        );

      case 'boolean':
        return <Switch {...commonProps} />;

      case 'select':
        return (
          <Select {...commonProps} allowClear>
            {param.options?.map((opt) => (
              <Option key={String(opt.value)} value={opt.value}>
                {opt.label}
              </Option>
            ))}
          </Select>
        );

      case 'password':
        return (
          <Input.Password
            {...commonProps}
            visibilityToggle={{
              visible: showPasswords[param.name],
              onVisibleChange: () => togglePasswordVisibility(param.name),
            }}
          />
        );

      case 'url':
        return <Input {...commonProps} type="url" addonBefore="https://" />;

      case 'string':
      default:
        return (
          <Input
            {...commonProps}
            maxLength={param.validation?.maxLength}
            showCount={!!param.validation?.maxLength}
          />
        );
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onValuesChange={handleValuesChange}
      initialValues={values}
    >
      {parameters.map((param) => (
        <Form.Item
          key={param.name}
          name={param.name}
          label={
            <span>
              {param.label}
              {param.required && <span style={{ color: '#ff4d4f' }}> *</span>}
              {param.description && (
                <Tooltip title={param.description}>
                  <InfoCircleOutlined
                    style={{ marginLeft: 4, color: '#8c8c8c' }}
                  />
                </Tooltip>
              )}
            </span>
          }
          validateStatus={errors[param.name] ? 'error' : undefined}
          help={errors[param.name]}
          valuePropName={param.type === 'boolean' ? 'checked' : 'value'}
        >
          {renderField(param)}
        </Form.Item>
      ))}
    </Form>
  );
};

export default ParameterForm;
