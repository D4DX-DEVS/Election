import { User, Franchise, Election, Nominee, Vote, ElectionGroup, VoterGroup, ElectionAnalytic } from "@shared/schema";

export type { Election, Nominee, ElectionGroup, Franchise, User, Vote, VoterGroup, ElectionAnalytic };

/** API entity shape from election-api (_id + id are Supabase UUID strings). */
export interface ApiEntityFormat {
  _id?: string;
  id?: string;
  electionAccess?: string[];
}

export interface UserWithElections extends User {
  elections?: Election[];
}

export interface ElectionWithDetails extends ApiEntityFormat {
  franchiseId?: string;
  franchise?: Franchise;
  nominees?: Nominee[];
  voters?: User[];
  analytics?: ElectionAnalytic;
  title?: string;
  organization: string;
  electionDate: string | Date;
  numberToBeElected: number;
  status: string;
  maxVoters?: number;
  maxNominees?: number;
  voterCount?: number;
  nomineeCount?: number;
  genderBasedSelection?: boolean;
  maleMinimum?: number;
  femaleMinimum?: number;
  selfRegOpen?: boolean;
  votingOpen?: boolean;
  resultsPublished?: boolean;
  resultsPublishedAt?: string | Date | null;
  voterResultDisplay?: "result_only" | "percentage" | "score" | "full";
  nomineeDisplayOrder?: string;
  createdBy?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  logo?: {
    url?: string;
    alt?: string;
  };
}

export interface NomineeWithVotes extends Nominee {
  voteCount?: number;
  percentage?: number;
}

export interface DashboardStats {
  activeElections: number;
  totalVoters: number;
  votesCast: number;
  totalFranchises: number;
  totalElections: number;
  franchiseDistribution: {
    id?: string;
    name: string;
    websiteUrl?: string | null;
    contactNumber?: string | null;
    electionCount?: number;
    percentage: number;
  }[];
  recentActivity: {
    action: string;
    timestamp: string;
    type: "success" | "info" | "warning";
  }[];
}

export interface VoteValidationError {
  message: string;
  type: "male" | "female" | "max" | "min";
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages?: number;
}

export interface ElectionFilter {
  franchiseId?: string;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface VoterFilter {
  electionId?: string;
  status?: string;
  search?: string;
}

export interface BulkVoterGenerationOptions {
  prefix: string;
  shuffledPrefix?: string;
  startingNumber: number;
  count: number;
  electionIds?: string[];
  voterGroupId?: string;
  assignmentType: "election" | "voterGroup";
}

export type ElectionStatus = "draft" | "active" | "completed" | "archived";
export type VoteStatus = "voted" | "pending";
export type NomineeStatus = "active" | "withdrawn" | "disqualified";
