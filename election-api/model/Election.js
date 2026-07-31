const mongoose = require("mongoose");

const ElectionSchema = new mongoose.Schema(
  {
    franchiseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Franchise",
    },
    organization: String,
    title: String,
    electionDate: Date,
    endDate: Date,
    numberToBeElected: Number,
    nomineeDisplayOrder: String,
    maxVoters: Number,
    maxNominees: Number,
    genderBasedSelection: {
      type: Boolean,
      default: false,
    },
    maleMinimum: Number,
    femaleMinimum: Number,
    selfRegOpen: Boolean,
    votingOpen: Boolean,
    resultsPublished: {
      type: Boolean,
      default: false,
    },
    resultsPublishedAt: Date,
    resultGenerationMode: {
      type: String,
      enum: ["auto", "manual"],
      default: "manual",
    },
    voterResultDisplay: {
      type: String,
      enum: ["none", "result_only", "percentage", "score", "full"],
      default: "none",
    },
    adminVotingDetailsEnabled: {
      type: Boolean,
      default: false,
    },
    manualWinnerSelection: {
      type: Boolean,
      default: false,
    },
    manualWinnerIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Nominee",
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    status: {
      type: String,
      enum: ["draft", "active", "completed", "archived"],
    },
    autoCompleteDisabled: {
      type: Boolean,
      default: false,
    },
    logo: {
      url: String,
      alt: String,
    },
    electionGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ElectionGroup",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Election || mongoose.model("Election", ElectionSchema);
