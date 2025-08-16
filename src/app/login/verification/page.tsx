import VerificationForm from '../../../components/auth/verification-form';
import { Suspense } from 'react';
import LoadingSpinner from '@/components/loading-spinner';

export default function VerificationPage() {
  return (
    <div>
      <Suspense fallback={<LoadingSpinner message="Doğrulama sayfası yükleniyor..." />}>
        <VerificationForm />
      </Suspense>
    </div>
  );
}