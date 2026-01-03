/**
 * Apply Wizard Component
 * Step-by-step wizard for applying templates with parameter configuration
 */

import {
  CheckCircleOutlined,
  CopyOutlined,
  LeftOutlined,
  RightOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  message,
  Result,
  Space,
  Steps,
  Typography,
} from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { templateApplier } from '../services';
import type { Template } from '../types';
import { ParameterForm } from './ParameterForm';
import { YamlPreview } from './YamlPreview';

const { Title, Text, Paragraph } = Typography;

interface ApplyWizardProps {
  template: Template;
  onApply: (yaml: string) => void;
  onCancel: () => void;
}

type WizardStep = 'overview' | 'configure' | 'preview' | 'complete';

const STEPS: { key: WizardStep; title: string }[] = [
  { key: 'overview', title: 'Overview' },
  { key: 'configure', title: 'Configure' },
  { key: 'preview', title: 'Preview' },
  { key: 'complete', title: 'Complete' },
];

export const ApplyWizard: React.FC<ApplyWizardProps> = ({
  template,
  onApply,
  onCancel,
}) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>('overview');
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generatedYaml, setGeneratedYaml] = useState('');

  // Initialize default parameters
  useEffect(() => {
    const defaults = templateApplier.getDefaultParams(template.content.parameters);
    setParams(defaults);
  }, [template]);

  const currentStepIndex = useMemo(
    () => STEPS.findIndex((s) => s.key === currentStep),
    [currentStep]
  );

  const handleParamsChange = useCallback(
    (newParams: Record<string, unknown>) => {
      setParams(newParams);
      const validation = templateApplier.validateParams(
        template.content.parameters,
        newParams
      );
      setErrors(validation.errors);
    },
    [template.content.parameters]
  );

  const handleNext = useCallback(() => {
    switch (currentStep) {
      case 'overview':
        if (template.content.parameters.length === 0) {
          // Skip configure step if no parameters
          const yaml = templateApplier.apply(template, {});
          setGeneratedYaml(yaml);
          setCurrentStep('preview');
        } else {
          setCurrentStep('configure');
        }
        break;
      case 'configure':
        const validation = templateApplier.validateParams(
          template.content.parameters,
          params
        );
        if (!validation.valid) {
          setErrors(validation.errors);
          message.error('Please fix the parameter errors before continuing');
          return;
        }
        const yaml = templateApplier.apply(template, params);
        setGeneratedYaml(yaml);
        setCurrentStep('preview');
        break;
      case 'preview':
        onApply(generatedYaml);
        setCurrentStep('complete');
        break;
    }
  }, [currentStep, template, params, generatedYaml, onApply]);

  const handleBack = useCallback(() => {
    switch (currentStep) {
      case 'configure':
        setCurrentStep('overview');
        break;
      case 'preview':
        if (template.content.parameters.length === 0) {
          setCurrentStep('overview');
        } else {
          setCurrentStep('configure');
        }
        break;
      case 'complete':
        setCurrentStep('preview');
        break;
    }
  }, [currentStep, template.content.parameters.length]);

  const handleCopyYaml = useCallback(async () => {
    await navigator.clipboard.writeText(generatedYaml);
    message.success('YAML copied to clipboard');
  }, [generatedYaml]);

  const canProceed = useMemo(() => {
    if (currentStep === 'configure') {
      return Object.keys(errors).length === 0;
    }
    return true;
  }, [currentStep, errors]);

  const renderStepContent = () => {
    switch (currentStep) {
      case 'overview':
        return (
          <div>
            <Title level={4}>{template.name}</Title>
            <Paragraph>{template.description}</Paragraph>

            <Card size="small" title="What this template does" style={{ marginBottom: 16 }}>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li>Category: {template.category}</li>
                <li>Platforms: {template.platforms.join(', ')}</li>
                <li>Version: {template.version}</li>
                <li>Parameters: {template.content.parameters.length}</li>
              </ul>
            </Card>

            {template.content.parameters.length > 0 && (
              <Card size="small" title="Parameters you will configure">
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {template.content.parameters.map((param) => (
                    <li key={param.name}>
                      <Text strong>{param.label}</Text>
                      {param.required && <Text type="danger"> *</Text>}
                      {param.description && (
                        <Text type="secondary"> - {param.description}</Text>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        );

      case 'configure':
        return (
          <div>
            <Title level={4}>Configure Parameters</Title>
            <Paragraph type="secondary">
              Fill in the required parameters to customize this template for your use case.
            </Paragraph>
            <ParameterForm
              parameters={template.content.parameters}
              values={params}
              errors={errors}
              onChange={handleParamsChange}
            />
          </div>
        );

      case 'preview':
        return (
          <div>
            <Title level={4}>Preview Generated YAML</Title>
            <Paragraph type="secondary">
              Review the generated YAML before applying. You can copy or modify it later.
            </Paragraph>
            <YamlPreview
              yaml={generatedYaml}
              title={`${template.name} - Generated YAML`}
              maxHeight={350}
            />
          </div>
        );

      case 'complete':
        return (
          <Result
            status="success"
            title="Template Applied Successfully!"
            subTitle={`The "${template.name}" template has been applied to your test case.`}
            extra={[
              <Button
                key="copy"
                icon={<CopyOutlined />}
                onClick={handleCopyYaml}
              >
                Copy YAML
              </Button>,
              <Button key="done" type="primary" onClick={onCancel}>
                Done
              </Button>,
            ]}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="apply-wizard">
      {/* Steps indicator */}
      <Steps
        current={currentStepIndex}
        items={STEPS.map((step) => ({
          title: step.title,
          icon: currentStepIndex > STEPS.findIndex((s) => s.key === step.key) ? (
            <CheckCircleOutlined />
          ) : undefined,
        }))}
        style={{ marginBottom: 24 }}
      />

      {/* Step content */}
      <div style={{ minHeight: 300, marginBottom: 24 }}>
        {renderStepContent()}
      </div>

      {/* Navigation buttons */}
      {currentStep !== 'complete' && (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button onClick={onCancel}>Cancel</Button>
          <Space>
            {currentStep !== 'overview' && (
              <Button icon={<LeftOutlined />} onClick={handleBack}>
                Back
              </Button>
            )}
            <Button
              type="primary"
              icon={currentStep === 'preview' ? undefined : <RightOutlined />}
              onClick={handleNext}
              disabled={!canProceed}
            >
              {currentStep === 'preview' ? 'Apply Template' : 'Next'}
            </Button>
          </Space>
        </div>
      )}
    </div>
  );
};

export default ApplyWizard;
