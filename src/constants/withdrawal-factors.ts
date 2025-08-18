export type EvaluationFactor = 
  | 'crypto_withdrawal'
  | 'exceed_manual_review_threshold'
  | 'manual_review_player'
  | 'suspicious_game_exposure'
  | 'suspicious_sport_exposure'
  | 'high_balance_without_deposit'
  | 'excluded_from_bonus'
  | 'ip_conflict'
  | 'has_safe_bets'
  | 'hidden_sport_bets'
  | 'hidden_free_spin_winnings'
  | 'limited_player'
  | 'exceed_bonus_balance_threshold'
  | 'no_activity'
  | 'withdrawal_amount_less_than_deposit'
  | 'unmet_sports_wagering'
  | 'unmet_casino_wagering'
  | 'unmet_bonus_sports_wagering'
  | 'unmet_bonus_casino_wagering'
  | 'has_active_sport_bets'
  | 'invalid_player_identity'
  | 'invalid_amount'
  | 'exceed_player_activity_max_amount'
  | 'under_player_activity_min_amount'
  | 'exceed_max_withdrawal_amount'
  | 'under_min_withdrawal_amount'
  | 'total_withdrawal_limit_by_deposit_amount_exceeded'
  | 'late_request'
  | 'early_withdrawal_attempt'
  | 'daily_withdrawal_limit_exceeded'
  | 'requires_full_withdrawal'
  | 'payment_method_disabled'
  | 'error_occurred';


export const EvaluationToRejectReasonMap: Record<string, string> = {
  'unmet_sports_wagering': 'anapara_cevrim',
  'unmet_casino_wagering': 'anapara_cevrim',
  'unmet_bonus_sports_wagering': 'acik_bonus_cevrim',
  'unmet_bonus_casino_wagering': 'acik_bonus_cevrim',
  'has_active_sport_bets': 'acik_bahis_cevrim',
  'invalid_player_identity': 'tc_hata',
  'invalid_amount': 'on_katlari',
  'exceed_player_activity_max_amount': 'bonus_sinir',
  'under_player_activity_min_amount': 'bonus_sinir',
  'exceed_max_withdrawal_amount': 'yatirim_sinir',
  'under_min_withdrawal_amount': 'yatirim_sinir',
  'total_withdrawal_limit_by_deposit_amount_exceeded': 'yatirim_sinir',
  'late_request': 'yeni_gun',
  'early_withdrawal_attempt': 'sekiz_saatte_cekim',
  'daily_withdrawal_limit_exceeded': '',
  'requires_full_withdrawal': 'anapara_cevrim',
  'payment_method_disabled': 'yontem_sorunu',
//
  'ip_conflict': 'ip_coklu',
  'has_safe_bets': 'safe_bahis',
  'excluded_from_bonus': 'kurma_bahis',
  'suspicious_game_exposure': 'casino_kurma_bahis',
  'suspicious_sport_exposure': 'kurma_bahis',
  'high_balance_without_deposit': 'kurma_bahis',
  'hidden_sport_bets': 'yatirim_bonus_suistimal',
  'hidden_free_spin_winnings': 'yatirim_bonus_suistimal',
  'limited_player': 'kurma_bahis',
  'exceed_bonus_balance_threshold': 'anapara_cevrim',
  'no_activity': 'ozel_oyun_kontrol',
  'withdrawal_amount_less_than_deposit': 'kurma_bahis',
  'crypto_withdrawal': 'yontem_sorunu',
  
};


export const EvaluationFactorNotes: Record<string, string> = {
  'crypto_withdrawal': 'Kripto yöntemi ile çekim, manuel inceleme gerekmektedir.',
  'exceed_manual_review_threshold': 'Manuel inceleme için belirlenen çekim limiti aşıldı.', 
  'manual_review_player': 'Manuele alınmış kullanıcı.',
  'suspicious_game_exposure': 'Riskli oyunlarda bahis alımı mevcut.', 
  'suspicious_sport_exposure': 'Riskli spor bahisleri mevcut.',
  'high_balance_without_deposit': 'Yatırım yapılmadan önceki bakiye, belirlenen bakiye limitini aşıyor.',
  'excluded_from_bonus': '"Bonus Kullanamaz" kategorisinde olan kullanıcı fakat son aktivitesi bonustur.',
  'ip_conflict': 'IP çakışması tespit edildi',
  'has_safe_bets': 'Safe bahis alımı mevcut.', 
  'hidden_sport_bets': 'Bet saklama tespit edildi. Bahis ID\'leri: {betIds}', 
  'hidden_free_spin_winnings': '{id} ID\'li {product} oyunda, {date} {time} tarihinde, {amount} TL kazancı, geçmiş finansal işlemlere ait bir FreeSpin veya Spin\'den gelmektedir.',
  'limited_player': 'Bonus "Kullanamaz" kategorisinde olan kullanıcı.',
  'exceed_bonus_balance_threshold': 'Kullanıcı, çevrim şartını tamamlamadan önce bonus cüzdanında yüksek bir bakiyeye ulaştı.',
  'no_activity': 'Kullanıcının son 30 günde aktivitesi yok.',
  'withdrawal_amount_less_than_deposit': 'Çekim tutarı, yatırıma eşit veya daha az.',
  'unmet_sports_wagering': 'Spor çevrim şartı eksik. Kalan: {remaining} TL',
  'unmet_casino_wagering': 'Casino çevrim şartı eksik. Kalan: {remaining} TL',
  'unmet_bonus_sports_wagering': 'Bonus spor çevrim şartı eksik. Kalan: {remaining} TL',
  'unmet_bonus_casino_wagering': 'Bonus casino çevrim şartı eksik. Kalan: {remaining} TL',
  'unmet_post_deposit_balance_sports_wagering': 'Spor çevrimi 1.5 katının altında.',
  'unmet_post_deposit_balance_casino_wagering': 'Casino çevrimi 1.5 katının altında.',
  'has_active_sport_bets': 'Aktif spor bahsi mevcut.',
  'invalid_player_identity': 'TC Kimlik numarası hatalı.',
  'invalid_amount': 'Geçersiz çekim tutarı. Miktar 10 ve katları olacak şekilde talep oluşturabilirsiniz.',
  'exceed_player_activity_max_amount': 'Minimum {minAmount} TL, Maximum {maxAmount} TL çekim talebi oluşturabilirsiniz.',
  'under_player_activity_min_amount': 'Minimum {minAmount} TL, Maximum {maxAmount} TL çekim talebi oluşturabilirsiniz.',
  'exceed_max_withdrawal_amount': 'Maximum çekim tutarı üstünde talep.',
  'under_min_withdrawal_amount': 'Minimum çekim tutarının altında talep.',
  'total_withdrawal_limit_by_deposit_amount_exceeded': 'Yatırıma bağlı maximum çekim limiti aşıldı. Toplam çekim limiti: {totalLimit} TL, Kalan çekim limiti: {remainingLimit} TL',
  'late_request': 'Yeni gün talep.',
  'early_withdrawal_attempt': 'Son çekim tarihinden sonra çekim yapabileceği zaman: {canWithdrawAt}, Kalan süre: {remainingTime}',
  'daily_withdrawal_limit_exceeded': 'Günlük kesili üye.',
  'requires_full_withdrawal': 'Tüm bakiye talep verebilirsiniz.',
  'payment_method_disabled': 'Ödeme yöntemi devre dışı. Farklı bir yöntem deneyiniz.',
  'casino_increasing_winning_ratio_exceeded': 'Casino oyunlarında alınan betler sonrası yansıyan kazanç, bet miktarının 2 katından az ve tüm bet işlemlerinin %50si veya daha fazlasını oluşturuyor.',
  'error_occurred': 'Hata oluştu, manuel inceleyiniz.',
  'first_withdrawal': 'İLK ÇEKİM ',
};

export function mapEvaluationFactorToRejectReason(factor: EvaluationFactor): string | null {
  return EvaluationToRejectReasonMap[factor] || null;
}

export function findFirstRejectReason(factors: EvaluationFactor[]): string | null {
  for (const factor of factors) {
    const reason = mapEvaluationFactorToRejectReason(factor);
    if (reason) return reason;
  }
  return null;
}

export function generateFactorNote(factor: EvaluationFactor, metadata?: Record<string, any>): string {
  const template = EvaluationFactorNotes[factor];
  if (!template) {
    return `Factor: ${factor}`;
  }

  if (!metadata) {
    return template;
  }

  let note = template;

  switch (factor) {
    case 'unmet_sports_wagering':
    case 'unmet_bonus_sports_wagering':
      const sportProgress = metadata.sportWageringProgress;
      if (sportProgress) {
        const remaining = sportProgress.requiredWager - sportProgress.settledBetWager;
        note = note
          .replace('{requiredWager}', sportProgress.requiredWager?.toString() || '0')
          .replace('{settledBetWager}', sportProgress.settledBetWager?.toString() || '0')
          .replace('{activeBetWager}', sportProgress.activeBetWager?.toString() || '0')
          .replace('{remaining}', remaining?.toString() || '0');
      }
      break;

    case 'unmet_casino_wagering':
    case 'unmet_bonus_casino_wagering':
      const casinoProgress = metadata.casinoWageringProgress;
      if (casinoProgress) {
        const remaining = casinoProgress.requiredWager - casinoProgress.wager;
        note = note
          .replace('{requiredWager}', casinoProgress.requiredWager?.toString() || '0')
          .replace('{wager}', casinoProgress.wager?.toString() || '0')
          .replace('{remaining}', remaining?.toString() || '0');
      }
      break;

    case 'hidden_sport_bets':
      const hiddenBets = metadata.hiddenSportBets;
      if (hiddenBets && Array.isArray(hiddenBets)) {
        const betIds = hiddenBets.map(bet => bet.id).join(', ');
        note = note.replace('{betIds}', betIds);
      }
      break;

    case 'hidden_free_spin_winnings':
      const hiddenWinnings = metadata.hiddenFreeSpinWinnings;
      if (hiddenWinnings && Array.isArray(hiddenWinnings)) {
        const firstWin = hiddenWinnings[0];
        if (firstWin) {
          const date = new Date(firstWin.createdAt);
          const formattedDate = date.toLocaleDateString('tr-TR');
          const formattedTime = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
          
          note = note
            .replace('{id}', firstWin.id?.toString() || '')
            .replace('{product}', firstWin.product || 'Oyun')
            .replace('{date}', formattedDate)
            .replace('{time}', formattedTime)
            .replace('{amount}', firstWin.amount?.toString() || '0');
        }
      }
      break;

    case 'early_withdrawal_attempt':
      if (metadata.earlyWithdrawalAttempt) {
        const { remainingTime, canWithdrawAt } = metadata.earlyWithdrawalAttempt;
        
        if (remainingTime && canWithdrawAt) {
          const timeInSeconds = Math.floor(remainingTime / 1000000000);
          
          const remainingHours = Math.floor(timeInSeconds / 3600);
          const remainingMinutes = Math.floor((timeInSeconds % 3600) / 60);
          const formattedRemainingTime = `${remainingHours}s ${remainingMinutes}dk`;
          
          const canWithdrawDate = new Date(canWithdrawAt);
          const formattedCanWithdrawAt = canWithdrawDate.toLocaleString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          
          note = note
            .replace('{remainingTime}', formattedRemainingTime)
            .replace('{canWithdrawAt}', formattedCanWithdrawAt);
        }
      }
      break;

    case 'exceed_player_activity_max_amount':
      if (metadata.exceedPlayerActivityMaxAmount?.maxAmount !== undefined) {
        const maxAmount = metadata.exceedPlayerActivityMaxAmount.maxAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        
        if (metadata.exceedPlayerActivityMaxAmount?.minAmount !== undefined && metadata.exceedPlayerActivityMaxAmount?.minAmount !== null) {
          const minAmount = metadata.exceedPlayerActivityMaxAmount.minAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          note = note
            .replace('{minAmount}', minAmount)
            .replace('{maxAmount}', maxAmount);
        } else {
          note = `Maximum ${maxAmount} TL çekim talebi oluşturabilirsiniz.`;
        }
      }
      break;

    case 'under_player_activity_min_amount':
      if (metadata.underPlayerActivityMinAmount?.minAmount !== undefined) {
        const minAmount = metadata.underPlayerActivityMinAmount.minAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        
        if (metadata.underPlayerActivityMinAmount?.maxAmount !== undefined && metadata.underPlayerActivityMinAmount?.maxAmount !== null) {
          const maxAmount = metadata.underPlayerActivityMinAmount.maxAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          note = note
            .replace('{minAmount}', minAmount)
            .replace('{maxAmount}', maxAmount);
        } else {
          note = `Minimum ${minAmount} TL çekim talebi oluşturabilirsiniz.`;
        }
      }
      break;

    case 'total_withdrawal_limit_by_deposit_amount_exceeded':
      if (metadata.totalWithdrawalLimitByDepositAmountExceeded?.totalLimit !== undefined && metadata.totalWithdrawalLimitByDepositAmountExceeded?.remainingLimit !== undefined) {
        note = note
          .replace('{totalLimit}', metadata.totalWithdrawalLimitByDepositAmountExceeded.totalLimit.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
          .replace('{remainingLimit}', metadata.totalWithdrawalLimitByDepositAmountExceeded.remainingLimit.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      }
      break;

    default:
      break;
  }

  return note;
}

export function generateCombinedNote(factors: EvaluationFactor[], metadata?: Record<string, any>): string {
  if (factors.length === 0) return '';
  
  const notes = factors.map(factor => generateFactorNote(factor, metadata));
  return notes.join(' | ');
}

// Otomatik değerlendirme factor'ı için reject reason bulan fonksiyon
export function getAutoEvaluationFactorRejectReason(evaluationFactor: string): string | null {
  return EvaluationToRejectReasonMap[evaluationFactor] || null;
}

// Otomatik değerlendirme factor'ları için ilk reject reason'ı bulan fonksiyon  
export function findFirstAutoEvaluationRejectReason(evaluationFactors: string[]): string | null {
  for (const factor of evaluationFactors) {
    const reason = getAutoEvaluationFactorRejectReason(factor);
    if (reason && reason !== '') return reason;
  }
  return null;
}

// Otomatik değerlendirme factor'ı için note oluşturan fonksiyon
export function generateAutoEvaluationFactorNote(evaluationFactor: string, metadata?: Record<string, any>): string {
  return generateFactorNote(evaluationFactor as EvaluationFactor, metadata);
}

// Otomatik değerlendirme factor'ları için combined note oluşturan fonksiyon
export function generateAutoEvaluationFactorsCombinedNote(evaluationFactors: string[], metadata?: Record<string, any>): string {
  if (evaluationFactors.length === 0) return '';
  
  const notes = evaluationFactors.map(factor => generateAutoEvaluationFactorNote(factor, metadata));
  return notes.join(' | ');
}
