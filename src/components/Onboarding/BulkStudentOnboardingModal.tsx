// Dedicated Student Onboarding Modal Wrapper
import React from 'react';
import { BulkOnboardingModal } from './BulkOnboardingModal';

interface BulkStudentOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultClassId?: string;
}

export const BulkStudentOnboardingModal: React.FC<BulkStudentOnboardingModalProps> = ({
  isOpen,
  onClose,
  defaultClassId,
}) => {
  return (
    <BulkOnboardingModal
      isOpen={isOpen}
      onClose={onClose}
      initialEntity="STUDENTS"
      defaultClassId={defaultClassId}
    />
  );
};
