export type IntakeType = 'judgmentAppeal' | 'contractsBusiness' | null;

export type JudgmentIntakeData = {
  verdictType: string;
  appearanceType: string;
  notificationStatus: string;
  notificationDate: string;
  court: string;
  role: string;
  hasExecution: string;
  hasJudgmentCopy: string;
  details: string;
};

export type ContractIntakeData = {
  contractType: string;
  userRole: string;
  hasWrittenContract: string;
  isSigned: string;
  mainIssue: string;
  hasMoney: string;
  moneyDetails: string;
  hasPenaltyClause: string;
  hasDuration: string;
  durationDetails: string;
  hasJurisdictionClause: string;
  hasIpOrConfidentiality: string;
  stage: string;
  details: string;
};

export const EMPTY_JUDGMENT_INTAKE: JudgmentIntakeData = {
  verdictType: '',
  appearanceType: '',
  notificationStatus: '',
  notificationDate: '',
  court: '',
  role: '',
  hasExecution: '',
  hasJudgmentCopy: '',
  details: '',
};

export const EMPTY_CONTRACT_INTAKE: ContractIntakeData = {
  contractType: '',
  userRole: '',
  hasWrittenContract: '',
  isSigned: '',
  mainIssue: '',
  hasMoney: '',
  moneyDetails: '',
  hasPenaltyClause: '',
  hasDuration: '',
  durationDetails: '',
  hasJurisdictionClause: '',
  hasIpOrConfidentiality: '',
  stage: '',
  details: '',
};