// Dedicated Teacher & Staff Onboarding Modal Wrapper
import React from 'react';
import { BulkOnboardingModal } from './BulkOnboardingModal';

interface BulkTeacherOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BulkTeacherOnboardingModal: React.FC<BulkTeacherOnboardingModalProps> = ({
  isOpen,
  onClose,
}) => {
  return (
    <BulkOnboardingModal
      isOpen={isOpen}
      onClose={onClose}
      initialEntity="TEACHERS"
    />
  );
};
