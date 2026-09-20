import { describe, expect, it } from "vitest";
import {
  canAccessAssignedWork,
  canAccessClientRecord,
  canAccessOrganizationResource,
  canWriteMembership,
  hasPermission,
  mapLegacyRole,
} from "./organization-roles";

describe("organization roles", () => {
  it("denies access by default when no role is present", () => {
    expect(hasPermission(null, "section.command-center")).toBe(false);
    expect(
      canAccessOrganizationResource({
        role: null,
        membershipStatus: "active",
        actorOrganizationId: "org-a",
        resourceOrganizationId: "org-a",
        permission: "settings.business.write",
      }).allowed,
    ).toBe(false);
  });

  it("maps the legacy admin label to administrator without granting owner powers", () => {
    expect(mapLegacyRole("admin")).toBe("administrator");
    expect(hasPermission("administrator", "security.ownership")).toBe(false);
    expect(hasPermission("administrator", "credentials.read")).toBe(false);
    expect(hasPermission("owner", "security.ownership")).toBe(true);
  });

  it("blocks cross-organization reads and writes even for owners", () => {
    const result = canAccessOrganizationResource({
      role: "owner",
      membershipStatus: "active",
      actorOrganizationId: "org-a",
      resourceOrganizationId: "org-b",
      permission: "settings.business.write",
    });
    expect(result).toEqual({ allowed: false, reason: "cross_organization" });
  });

  it("keeps accountants out of ownership, credentials, and unrelated sections", () => {
    expect(hasPermission("accountant", "section.accountant")).toBe(true);
    expect(hasPermission("accountant", "section.finance")).toBe(true);
    expect(hasPermission("accountant", "settings.business.read")).toBe(true);
    expect(hasPermission("accountant", "settings.business.write")).toBe(false);
    expect(hasPermission("accountant", "security.ownership")).toBe(false);
    expect(hasPermission("accountant", "credentials.read")).toBe(false);
    expect(hasPermission("accountant", "section.integrations")).toBe(false);
    expect(hasPermission("accountant", "section.invoices")).toBe(true);
    expect(hasPermission("accountant", "section.documents")).toBe(true);
    expect(hasPermission("employee", "section.invoices")).toBe(false);
    expect(hasPermission("employee", "section.calendar")).toBe(true);
    expect(hasPermission("employee", "section.documents")).toBe(true);
    expect(hasPermission("accountant", "org.members.manage")).toBe(false);
  });

  it("limits contractors to assigned work and clients to their own records", () => {
    expect(canAccessAssignedWork({ role: "contractor", assignedToActor: false }).reason).toBe("assigned_work_only");
    expect(canAccessAssignedWork({ role: "contractor", assignedToActor: true }).allowed).toBe(true);
    expect(hasPermission("contractor", "settings.business.write")).toBe(false);
    expect(
      canAccessClientRecord({
        role: "client",
        actorClientId: "client-1",
        resourceClientId: "client-2",
      }).reason,
    ).toBe("client_scope");
    expect(hasPermission("client", "section.command-center")).toBe(false);
    expect(hasPermission("client", "section.client-portal")).toBe(true);
  });

  it("prevents members from elevating their own role and keeps owner assignment owner-only", () => {
    expect(
      canWriteMembership({
        actorRole: "administrator",
        actorUserId: "admin-1",
        actorStatus: "active",
        actorOrganizationId: "org-a",
        targetUserId: "admin-1",
        targetOrganizationId: "org-a",
        currentRole: "administrator",
        nextRole: "owner",
      }),
    ).toEqual({ allowed: false, reason: "self_elevation" });
    expect(
      canWriteMembership({
        actorRole: "administrator",
        actorUserId: "admin-1",
        actorStatus: "active",
        actorOrganizationId: "org-a",
        targetUserId: "user-2",
        targetOrganizationId: "org-a",
        currentRole: "employee",
        nextRole: "owner",
      }),
    ).toEqual({ allowed: false, reason: "role_denied" });
    expect(
      canWriteMembership({
        actorRole: "owner",
        actorUserId: "owner-1",
        actorStatus: "active",
        actorOrganizationId: "org-a",
        targetUserId: "user-2",
        targetOrganizationId: "org-a",
        currentRole: "employee",
        nextRole: "administrator",
      }).allowed,
    ).toBe(true);
    expect(
      canWriteMembership({
        actorRole: "accountant",
        actorUserId: "books-1",
        actorStatus: "active",
        actorOrganizationId: "org-a",
        targetUserId: "user-2",
        targetOrganizationId: "org-a",
        currentRole: "employee",
        nextRole: "administrator",
      }).allowed,
    ).toBe(false);
    expect(
      canWriteMembership({
        actorRole: "owner",
        actorUserId: "owner-1",
        actorStatus: "active",
        actorOrganizationId: "org-a",
        targetUserId: "owner-2",
        targetOrganizationId: "org-a",
        currentRole: "owner",
        nextRole: "administrator",
        activeOwnerCount: 1,
      }),
    ).toEqual({ allowed: false, reason: "role_denied" });
  });

  it("does not treat an invited or disabled membership as authorization", () => {
    expect(
      canAccessOrganizationResource({
        role: "owner",
        membershipStatus: "invited",
        actorOrganizationId: "org-a",
        resourceOrganizationId: "org-a",
        permission: "section.command-center",
      }).allowed,
    ).toBe(false);
    expect(
      canAccessOrganizationResource({
        role: "administrator",
        membershipStatus: "disabled",
        actorOrganizationId: "org-a",
        resourceOrganizationId: "org-a",
        permission: "settings.business.write",
      }).allowed,
    ).toBe(false);
  });
});
