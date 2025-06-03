import VerificationForm from '../../../components/auth/verification-form';
import { Suspense } from 'react';

export default function VerificationPage() {
  return (
    <div>
      <Suspense fallback={<div>Yükleniyor...</div>}>
        <VerificationForm />
      </Suspense>
    </div>
  );
}