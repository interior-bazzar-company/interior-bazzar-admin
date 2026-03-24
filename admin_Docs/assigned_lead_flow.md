# Assigned Lead Flow Documentation

This document records the changes made to enable the "Assign Lead" flow in the Admin Dashboard.

## Overview
The "Assign Lead" flow allows administrators to search for a business and assign specific leads to it directly from the leads table.

## Changes Made

### 1. Lead Table Component
- **File**: `src/components/dashboard/Lead/LeadTable/index.tsx`
- **Updates**:
    - Added an **"Assign"** column to the table header.
    - Integrated the `AssignLead` modal component into the "Assign" column cells.
    - Added logic to trigger the modal via `handleAssignClick`.
    - Leveraged `onLeadAssigned` callback to update table state after successful assignment.

### 2. Lead Table Style
- **File**: `src/components/dashboard/Lead/LeadTable/LeadTable.module.css`
- **Updates**:
    - Added `.assigned` class styles to provide visual feedback for leads that already have a business assigned to them.

### 3. Admin API Service (Verified)
- **File**: `src/api/modules/admin/index.ts`
- **Endpoints Used**:
    - `AdminService.getSearchedBusinesses(query)`: Searches for businesses by name/city/pin.
    - `AdminService.getBusinessDetail(id)`: Fetches full details for preview.
    - `AdminService.assignLeadToBusiness(data)`: Performs the actual assignment via POST request.

## How the Flow Works
1. **Trigger**: Admin clicks the "Assign" button on a lead row.
2. **Search**: A modal opens allowing the admin to search for businesses.
3. **Select**: Selecting a business shows a preview card to verify the target.
4. **Action**: "Assign Lead" is clicked, calling the backend API.
5. **Success**: The modal closes, an alert is shown, and the table row updates to state "Assigned".

---
*Created on: 2026-03-24*
