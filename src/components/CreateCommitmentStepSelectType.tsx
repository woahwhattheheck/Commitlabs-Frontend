'use client';
import { useRef, useEffect, useMemo, useState } from 'react';
import { Shield, TrendingUp, Flame, ArrowRight, ChevronLeft, Info, Zap } from 'lucide-react';
import WizardStepper from './WizardStepper';
import styles from './CreateCommitmentStepSelectType.module.css';
import {
  COMMITMENT_PRESETS,
  SCRATCH_OPTION_ID,
  type CommitmentPreset,
} from './create/commitmentPresets';
import { fetchProtocolConstants, type ProtocolConstants } from '@/utils/protocol';

interface CommitmentType {
  id: 'safe' | 'balanced' | 'aggressive';
  title: string;
  icon: typeof Shield;
  duration: string;
  durationNote: string;
  maxLoss: string;
  maxLossNote: string;
  description: string;
  badge: string | null;
  badgeType: 'recommended' | 'risk' | null;
}

interface CreateCommitmentStepSelectTypeProps {
  selectedType: 'safe' | 'balanced' | 'aggressive' | null;
  onSelectType: (type: 'safe' | 'balanced' | 'aggressive') => void;
  onNext: (type: 'safe' | 'balanced' | 'aggressive') => void;
  onBack: () => void;
  initialFocusField?: string;
  onApplyPreset?: (preset: CommitmentPreset) => void;
}

const fallbackCommitmentTypes: CommitmentType[] = [
  {
    id: 'safe',
    title: 'Safe Commitment',
    icon: Shield,
    duration: '30 days',
    durationNote:
      'Minimum lock-in: 30 days. Early exit incurs a 2% penalty on your committed amount.',
    maxLoss: '2%',
    maxLossNote:
      'Your position is automatically closed if losses reach 2% of your committed amount, protecting your principal.',
    description: 'Lower risk, stable yield with minimal exposure.',
    badge: 'Recommended',
    badgeType: 'recommended',
  },
  {
    id: 'balanced',
    title: 'Balanced Commitment',
    icon: TrendingUp,
    duration: '60 days',
    durationNote:
      'Minimum lock-in: 60 days. Early exit incurs a 3% penalty on your committed amount.',
    maxLoss: '8%',
    maxLossNote:
      'Your position closes automatically at an 8% loss. Suitable for moderate risk tolerance.',
    description: 'Medium yield potential with controlled risk.',
    badge: null,
    badgeType: null,
  },
  {
    id: 'aggressive',
    title: 'Aggressive Commitment',
    icon: Flame,
    duration: '90 days',
    durationNote:
      'Minimum lock-in: 90 days. Early exit incurs a 5% penalty on your committed amount.',
    maxLoss: 'No protection',
    maxLossNote:
      'No automatic stop-loss. Your full committed amount is at risk. Only suitable for experienced users.',
    description: 'Highest yield potential with no loss protection.',
    badge: '⚠ High Risk',
    badgeType: 'risk',
  },
];

function buildCommitmentTypes(constants: ProtocolConstants | null): CommitmentType[] {
  if (!constants) return fallbackCommitmentTypes;

  const configuredByType = new Map(
    (constants.commitmentTypes ?? []).map((profile) => [profile.type, profile] as const),
  );
  const penaltyByType = new Map(
    constants.penalties.map((penalty) => [
      penalty.type.toLowerCase(),
      penalty.earlyExitPenaltyPercent,
    ] as const),
  );

  return fallbackCommitmentTypes.map((fallback) => {
    const configured = configuredByType.get(fallback.id);
    const configuredPenalty = penaltyByType.get(fallback.id);

    if (!configured && configuredPenalty === undefined) {
      return fallback;
    }

    const fallbackPenalty = Number(
      fallback.durationNote.match(/incurs a ([0-9.]+)% penalty/i)?.[1] ?? '0',
    );
    const durationDays = configured?.durationDays ?? Number.parseInt(fallback.duration, 10);
    const penaltyPercent = configuredPenalty ?? fallbackPenalty;

    let maxLoss = fallback.maxLoss;
    let maxLossNote = fallback.maxLossNote;

    if (configured) {
      if (configured.maxLossPercent === null) {
        maxLoss = 'No protection';
        maxLossNote =
          'No automatic stop-loss. Your full committed amount is at risk. Only suitable for experienced users.';
      } else {
        maxLoss = `${configured.maxLossPercent}%`;
        maxLossNote =
          `Your position is automatically closed if losses reach ${configured.maxLossPercent}% of your committed amount.`;
      }
    }

    return {
      ...fallback,
      duration: `${durationDays} days`,
      durationNote:
        `Minimum lock-in: ${durationDays} days. Early exit incurs a ${penaltyPercent}% penalty on your committed amount.`,
      maxLoss,
      maxLossNote,
    };
  });
}

export default function CreateCommitmentStepSelectType({
  selectedType,
  onSelectType,
  onNext,
  onBack,
  initialFocusField,
  onApplyPreset,
}: CreateCommitmentStepSelectTypeProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [protocolConstants, setProtocolConstants] = useState<ProtocolConstants | null>(null);

  useEffect(() => {
    let cancelled = false;

    void fetchProtocolConstants()
      .then((constants) => {
        if (!cancelled) setProtocolConstants(constants);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  const commitmentTypes = useMemo(
    () => buildCommitmentTypes(protocolConstants),
    [protocolConstants],
  );

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    if (initialFocusField) {
      const element = document.getElementById(initialFocusField);
      if (element) {
        element.focus();
        element.scrollIntoView({ block: 'center' });
      }
    }
  }, [initialFocusField]);

  const handleContinue = () => {
    if (selectedType) {
      onNext(selectedType);
    }
  };

  const handlePresetSelect = (preset: CommitmentPreset) => {
    onSelectType(preset.type);
    onApplyPreset?.(preset);
  };

  const handleScratchSelect = () => {
    // Just select without prefilling — user configures from defaults
  };

  return (
    <div className={styles.container}>
      <div className={styles.contentWrapper}>
        <button onClick={onBack} className={styles.backButton}>
          <ChevronLeft size={16} />
          Back to Home
        </button>

        <div className={styles.header}>
          <h1 className={styles.title}>Create Commitment</h1>
          <p className={styles.subtitle}>
            Define your liquidity commitment with explicit rules and guarantees
          </p>
        </div>

        <WizardStepper currentStep={1} />

        {/* Preset / Template Picker */}
        <div className={styles.titleSection}>
          <h2 className={styles.sectionTitle} tabIndex={-1}>
            <Zap
              size={18}
              style={{ display: 'inline', marginRight: '0.4rem', verticalAlign: 'middle' }}
            />
            Quick-start Templates
          </h2>
          <p className={styles.sectionSubtitle}>
            Choose a preset to prefill the next step, or start from scratch.
          </p>
        </div>

        <div
          role="radiogroup"
          aria-label="Commitment templates"
          className={styles.presetsContainer}
          data-testid="presets-container"
        >
          {COMMITMENT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              role="radio"
              aria-checked={selectedType === preset.type}
              data-testid={`preset-${preset.id}`}
              className={`${styles.presetBtn} ${selectedType === preset.type ? styles.presetBtnSelected : ''}`}
              onClick={() => handlePresetSelect(preset)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handlePresetSelect(preset);
                }
              }}
            >
              <span className={styles.presetLabel}>{preset.label}</span>
              <span className={styles.presetDesc}>{preset.description}</span>
            </button>
          ))}

          <button
            type="button"
            role="radio"
            aria-checked={false}
            data-testid={`preset-${SCRATCH_OPTION_ID}`}
            className={styles.presetBtn}
            onClick={handleScratchSelect}
          >
            <span className={styles.presetLabel}>Start from scratch</span>
            <span className={styles.presetDesc}>
              Pick a type below and configure every field yourself.
            </span>
          </button>
        </div>

        <div className={styles.titleSection}>
          <h2 ref={headingRef} tabIndex={-1} className={styles.sectionTitle}>
            Choose Your Commitment Type
          </h2>
          <p className={styles.sectionSubtitle}>
            Select the risk profile that matches your investment strategy
          </p>
        </div>

        <div
          id="commitment-type-container"
          className={styles.cardsContainer}
          role="radiogroup"
          aria-label="Commitment type"
          tabIndex={-1}
          style={{ outline: 'none' }}
        >
          {commitmentTypes.map((type) => {
            const Icon = type.icon;
            const isSelected = selectedType === type.id;

            return (
              <div
                key={type.id}
                onClick={() => onSelectType(type.id)}
                role="radio"
                aria-checked={isSelected}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectType(type.id);
                  }
                }}
                className={`${styles.card} ${
                  type.id === 'safe'
                    ? styles.cardSafe
                    : type.id === 'aggressive'
                      ? styles.cardAggressive
                      : styles.cardBalanced
                } ${isSelected ? styles.cardSelected : ''}`}
              >
                {type.badge && (
                  <div
                    className={`${styles.badge} ${
                      type.badgeType === 'recommended' ? styles.badgeRecommended : styles.badgeRisk
                    }`}
                  >
                    {type.badge}
                  </div>
                )}

                <div className={styles.iconContainer}>
                  <Icon
                    size={24}
                    className={
                      type.id === 'safe'
                        ? styles.iconEmerald
                        : type.id === 'balanced'
                          ? styles.iconBlue
                          : styles.iconOrange
                    }
                  />
                </div>

                <h3 className={styles.cardTitle}>{type.title}</h3>

                <div className={styles.statsContainer}>
                  <div className={styles.statBlock}>
                    <div className={styles.statRow}>
                      <span className={styles.statLabel}>Duration</span>
                      <span className={styles.statValue}>{type.duration}</span>
                    </div>
                    <p className={styles.constraintNote}>
                      <Info size={11} className={styles.noteIcon} />
                      {type.durationNote}
                    </p>
                  </div>

                  <div className={styles.statBlock}>
                    <div className={styles.statRow}>
                      <span className={styles.statLabel}>Max Loss</span>
                      <span
                        className={`${styles.statValue} ${
                          type.maxLoss === 'No protection' ? styles.statValueRisk : ''
                        }`}
                      >
                        {type.maxLoss}
                      </span>
                    </div>
                    <p
                      className={`${styles.constraintNote} ${type.id === 'aggressive' ? styles.constraintNoteRisk : ''}`}
                    >
                      <Info size={11} className={styles.noteIcon} />
                      {type.maxLossNote}
                    </p>
                  </div>
                </div>

                <p className={styles.description}>{type.description}</p>
              </div>
            );
          })}
        </div>

        <div className={styles.infoBox}>
          <p className={styles.infoText}>
            💡 <span className={styles.infoTextHighlight}>Tip:</span> Your commitment type
            determines the initial parameters. You can fine-tune duration and max loss in the next
            step.
          </p>
        </div>

        <div className={styles.actionButtons}>
          <button onClick={onBack} className={styles.backBtn}>
            Back
          </button>
          <button
            onClick={handleContinue}
            disabled={!selectedType}
            data-testid="select-type-continue"
            className={`${styles.continueBtn} ${
              selectedType ? styles.continueBtnEnabled : styles.continueBtnDisabled
            }`}
          >
            Continue
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
