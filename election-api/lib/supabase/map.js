const { resolvePublicImageUrl } = require("../spacesStorage");
const { toBodyBoolean } = require("../electionBody");
const {
  readFranchiseContactFields,
  mergeFranchiseSettings,
} = require("../franchiseSettings");

function mapUser(row, extras = {}) {
  if (!row) return null;
  const user = {
    _id: row.id,
    id: row.id,
    username: row.username,
    password: row.password,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    franchiseId: row.franchise_id,
    registrationNumber: row.registration_number,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLogin: row.last_login,
    status: row.status || "active",
    isVoter: row.is_voter,
    onboardingCompleted: row.onboarding_completed,
    electionAccess: extras.electionAccess || [],
  };
  if (row.voter_prefix || row.voter_sequence_number) {
    user.voterMetadata = {
      prefix: row.voter_prefix,
      sequenceNumber: row.voter_sequence_number,
    };
  }
  return user;
}

function userToRow(data) {
  const row = {};
  if (data.username !== undefined) row.username = data.username;
  if (data.password !== undefined) row.password = data.password;
  if (data.credentialCiphertext !== undefined) {
    row.credential_ciphertext = data.credentialCiphertext;
  }
  if (data.email !== undefined) row.email = data.email;
  if (data.fullName !== undefined) row.full_name = data.fullName;
  if (data.role !== undefined) row.role = data.role;
  if (data.franchiseId !== undefined) row.franchise_id = data.franchiseId || null;
  if (data.registrationNumber !== undefined) row.registration_number = data.registrationNumber;
  if (data.createdBy !== undefined) row.created_by = data.createdBy || null;
  if (data.lastLogin !== undefined) row.last_login = data.lastLogin;
  if (data.status !== undefined) row.status = data.status;
  if (data.isVoter !== undefined) row.is_voter = data.isVoter;
  if (data.onboardingCompleted !== undefined) row.onboarding_completed = data.onboardingCompleted;
  if (data.voterMetadata?.prefix !== undefined) row.voter_prefix = data.voterMetadata.prefix;
  if (data.voterMetadata?.sequenceNumber !== undefined) {
    row.voter_sequence_number = data.voterMetadata.sequenceNumber;
  }
  row.updated_at = new Date().toISOString();
  return row;
}

function mapFranchise(row) {
  if (!row) return null;
  const settings = row.settings && typeof row.settings === "object" ? row.settings : {};
  const contact = readFranchiseContactFields({ settings, ...row });

  return {
    _id: row.id,
    id: row.id,
    name: row.name,
    websiteUrl: contact.websiteUrl || undefined,
    contactNumber: contact.contactNumber || undefined,
    logo: row.logo_url
      ? { url: resolvePublicImageUrl(row.logo_url), alt: row.logo_alt }
      : undefined,
    status: row.status,
    settings,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function franchiseToRow(data, existingSettings = {}) {
  const row = {};
  if (data.name !== undefined) row.name = data.name;
  if (data.status !== undefined) row.status = data.status;
  if (data.logo?.url !== undefined) row.logo_url = data.logo.url;
  if (data.logo?.alt !== undefined) row.logo_alt = data.logo.alt;

  const shouldMergeSettings =
    data.settings !== undefined ||
    data.websiteUrl !== undefined ||
    data.contactNumber !== undefined;

  if (shouldMergeSettings) {
    row.settings = mergeFranchiseSettings(existingSettings, data);
  }

  row.updated_at = new Date().toISOString();
  return row;
}

function mapElection(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    franchiseId: row.franchise_id,
    organization: row.organization,
    title: row.title,
    electionDate: row.election_date,
    endDate: row.end_date,
    numberToBeElected: row.number_to_be_elected,
    ballotSelectionRule: row.ballot_selection_rule === "up_to" ? "up_to" : "exact",
    nomineeDisplayOrder: row.nominee_display_order,
    maxVoters: row.max_voters,
    maxNominees: row.max_nominees,
    genderBasedSelection: !!row.gender_based_selection,
    maleMinimum: row.male_minimum,
    femaleMinimum: row.female_minimum,
    selfRegOpen: !!row.self_reg_open,
    votingOpen: !!row.voting_open,
    resultsPublished: !!row.results_published,
    resultsPublishedAt: row.results_published_at,
    voterResultDisplay: row.voter_result_display,
    resultGenerationMode: row.result_generation_mode || "manual",
    adminVotingDetailsEnabled: !!row.admin_voting_details_enabled,
    allowRevote: !!row.allow_revote,
    manualWinnerSelection: !!row.manual_winner_selection,
    manualWinnerIds: Array.isArray(row.manual_winner_ids) ? row.manual_winner_ids : [],
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
    autoCompleteDisabled: !!row.auto_complete_disabled,
    logo: row.logo_url
      ? { url: resolvePublicImageUrl(row.logo_url), alt: row.logo_alt }
      : undefined,
    electionGroupId: row.election_group_id,
  };
}

function electionToRow(data) {
  const row = {};
  if (data.franchiseId !== undefined) row.franchise_id = data.franchiseId;
  if (data.organization !== undefined) row.organization = data.organization;
  if (data.title !== undefined) row.title = data.title;
  if (data.electionDate !== undefined) row.election_date = data.electionDate;
  if (data.endDate !== undefined) row.end_date = data.endDate || null;
  if (data.numberToBeElected !== undefined) row.number_to_be_elected = data.numberToBeElected;
  if (data.ballotSelectionRule !== undefined) {
    row.ballot_selection_rule = data.ballotSelectionRule === "up_to" ? "up_to" : "exact";
  }
  if (data.nomineeDisplayOrder !== undefined) row.nominee_display_order = data.nomineeDisplayOrder;
  if (data.maxVoters !== undefined) row.max_voters = data.maxVoters;
  if (data.maxNominees !== undefined) row.max_nominees = data.maxNominees;
  if (data.genderBasedSelection !== undefined) {
    row.gender_based_selection = toBodyBoolean(data.genderBasedSelection);
  }
  if (data.maleMinimum !== undefined) row.male_minimum = data.maleMinimum;
  if (data.femaleMinimum !== undefined) row.female_minimum = data.femaleMinimum;
  if (data.selfRegOpen !== undefined) row.self_reg_open = toBodyBoolean(data.selfRegOpen);
  if (data.votingOpen !== undefined) row.voting_open = toBodyBoolean(data.votingOpen);
  if (data.resultsPublished !== undefined) row.results_published = toBodyBoolean(data.resultsPublished);
  if (data.resultsPublishedAt !== undefined) row.results_published_at = data.resultsPublishedAt;
  if (data.voterResultDisplay !== undefined) row.voter_result_display = data.voterResultDisplay;
  if (data.resultGenerationMode !== undefined) row.result_generation_mode = data.resultGenerationMode;
  if (data.adminVotingDetailsEnabled !== undefined) {
    row.admin_voting_details_enabled = toBodyBoolean(data.adminVotingDetailsEnabled);
  }
  if (data.allowRevote !== undefined) row.allow_revote = toBodyBoolean(data.allowRevote);
  if (data.manualWinnerSelection !== undefined) {
    row.manual_winner_selection = toBodyBoolean(data.manualWinnerSelection);
  }
  if (data.manualWinnerIds !== undefined) row.manual_winner_ids = data.manualWinnerIds;
  if (data.createdBy !== undefined) row.created_by = data.createdBy;
  if (data.status !== undefined) row.status = data.status;
  if (data.autoCompleteDisabled !== undefined) {
    row.auto_complete_disabled = toBodyBoolean(data.autoCompleteDisabled);
  }
  if (data.electionGroupId !== undefined) row.election_group_id = data.electionGroupId;
  if (data.logo?.url !== undefined) row.logo_url = data.logo.url;
  if (data.logo?.alt !== undefined) row.logo_alt = data.logo.alt;
  row.updated_at = new Date().toISOString();
  return row;
}

function mapNominee(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    electionId: row.election_id,
    name: row.name,
    gender: row.gender,
    position: row.position,
    photo: row.photo_url
      ? { url: resolvePublicImageUrl(row.photo_url), alt: row.photo_alt }
      : undefined,
    bio: row.bio,
    description: row.bio,
    additionalInfo: row.additional_info,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
  };
}

function nomineeToRow(data) {
  const row = {};
  if (data.electionId !== undefined) row.election_id = data.electionId;
  if (data.name !== undefined) row.name = data.name;
  if (data.gender !== undefined) row.gender = data.gender;
  if (data.position !== undefined) row.position = data.position;
  if (data.bio !== undefined) row.bio = data.bio;
  if (data.description !== undefined) row.bio = data.description || null;
  if (data.additionalInfo !== undefined) row.additional_info = data.additionalInfo;
  if (data.status !== undefined) row.status = data.status;
  if (data.photo?.url !== undefined) row.photo_url = data.photo.url;
  if (data.photo?.alt !== undefined) row.photo_alt = data.photo.alt;
  row.updated_at = new Date().toISOString();
  return row;
}

function mapVote(row, nomineeIds = []) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    electionId: row.election_id,
    voterId: row.voter_id,
    nominees: nomineeIds,
    timestamp: row.voted_at || row.created_at,
    ipAddress: row.ip_address,
    deviceInfo: row.device_info,
    status: row.status,
  };
}

function mapVoterGroup(row, extras = {}) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    franchiseId: row.franchise_id,
    name: row.name,
    description: row.description,
    prefix: row.prefix,
    startingNumber: row.starting_number,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    voters: extras.voters || [],
    elections: extras.elections || [],
  };
}

function voterGroupToRow(data) {
  const row = {};
  if (data.franchiseId !== undefined) row.franchise_id = data.franchiseId;
  if (data.name !== undefined) row.name = data.name;
  if (data.description !== undefined) row.description = data.description;
  if (data.prefix !== undefined) row.prefix = data.prefix;
  if (data.startingNumber !== undefined) row.starting_number = data.startingNumber;
  if (data.createdBy !== undefined) row.created_by = data.createdBy;
  row.updated_at = new Date().toISOString();
  return row;
}

function mapElectionGroup(row, extras = {}) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    franchiseId: row.franchise_id,
    name: row.name,
    description: row.description,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    elections: extras.elections || [],
  };
}

function electionGroupToRow(data) {
  const row = {};
  if (data.franchiseId !== undefined) row.franchise_id = data.franchiseId;
  if (data.name !== undefined) row.name = data.name;
  if (data.description !== undefined) row.description = data.description;
  if (data.createdBy !== undefined) row.created_by = data.createdBy;
  row.updated_at = new Date().toISOString();
  return row;
}

function mapElectionAnalytics(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    electionId: row.election_id,
    totalVoters: row.total_voters,
    totalVotesCast: row.total_votes_cast,
    pendingVoters: row.pending_voters,
    nomineeResults: row.nominee_results,
    lastUpdated: row.last_updated,
    isFinalized: row.is_finalized,
  };
}

function mapAuditLog(row, user) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    userId: user || row.user_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    timestamp: row.created_at,
    ipAddress: row.ip_address,
    details: row.details,
  };
}

module.exports = {
  mapUser,
  userToRow,
  mapFranchise,
  franchiseToRow,
  mapElection,
  electionToRow,
  mapNominee,
  nomineeToRow,
  mapVote,
  mapVoterGroup,
  voterGroupToRow,
  mapElectionGroup,
  electionGroupToRow,
  mapElectionAnalytics,
  mapAuditLog,
};
