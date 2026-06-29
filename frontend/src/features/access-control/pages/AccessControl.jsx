import { useEffect, useMemo, useState } from 'react'
import {
  BarChart2,
  Briefcase,
  CalendarClock,
  Info,
  MoreVertical,
  Pencil,
  Plus,
  RotateCcw,
  ShieldCheck,
  Stethoscope,
  Trash2,
  Users,
  X,
} from 'lucide-react'

import {
  ErrorBanner,
  emptyStateClass,
  panelHeaderClass,
  surfaceClass,
} from '@shared/components/FormPrimitives'
import { useToast } from '@shared/components/Toast'
import { useAuth } from '@shared/context/AuthContext'
import { MODULES } from '@shared/lib/accessControlData'
import { getBackendError } from '@shared/lib/records'
import { stagger } from '@shared/lib/motion'
import {
  ACCESS_LEVELS,
  getAccessLevelMeta,
  normalizeAccessLevel,
} from '@shared/lib/permissions'
import {
  createRole,
  deleteRole,
  getRoles,
  setRolePermissions,
  updateRole,
} from '@shared/services/api'

const MODULE_META = {
  appointments: {
    icon: CalendarClock,
    label: 'Appointments',
  },
  doctors: {
    icon: Stethoscope,
    label: 'Doctors',
  },
  patients: {
    icon: Users,
    label: 'Patients',
  },
  reports: {
    icon: BarChart2,
    label: 'Reports',
  },
  staff: {
    icon: Briefcase,
    label: 'Staff',
  },
}

function normalizeRoleList(response) {
  if (Array.isArray(response?.results)) {
    return response.results
  }

  if (Array.isArray(response)) {
    return response
  }

  return []
}

function getRolePermissions(role) {
  const permissions = role?.module_permissions || role?.permissions || {}

  return MODULES.reduce((nextPermissions, module) => {
    const access = permissions[module] || 'no_access'
    nextPermissions[module] = normalizeAccessLevel(access)
    return nextPermissions
  }, {})
}

function mergeRole(currentRole, nextRole) {
  if (!nextRole) {
    return currentRole
  }

  return {
    ...currentRole,
    ...nextRole,
    module_permissions: getRolePermissions(nextRole),
    permissions: getRolePermissions(nextRole),
  }
}

function getInitials(name) {
  return String(name || 'Role')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'R'
}

function RoleSkeleton() {
  return (
    <div className="flex min-h-[76px] items-center gap-3 border-b border-hairline px-4 py-3 last:border-0">
      <div className="h-10 w-10 animate-shimmer rounded-full bg-gradient-to-r from-hairline via-canvas to-hairline bg-[length:200%_100%]" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-32 animate-shimmer rounded-full bg-gradient-to-r from-hairline via-canvas to-hairline bg-[length:200%_100%]" />
        <div className="h-3 w-20 animate-shimmer rounded-full bg-gradient-to-r from-hairline via-canvas to-hairline bg-[length:200%_100%]" />
      </div>
    </div>
  )
}

function RoleModal({ existingRoles = [], mode, onClose, onSubmit, role }) {
  const [name, setName] = useState(role?.name || '')
  const [description, setDescription] = useState(role?.description || '')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    const trimmedName = name.trim()

    if (!trimmedName) {
      setError('Role name is required.')
      return
    }

    if (trimmedName.length < 2) {
      setError('Role name must be at least 2 characters.')
      return
    }

    const duplicateRole = existingRoles.find(
      (candidate) =>
        String(candidate.id) !== String(role?.id) &&
        String(candidate.name || '').trim().toLowerCase() ===
          trimmedName.toLowerCase(),
    )

    if (duplicateRole) {
      setError('A role with this name already exists.')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      await onSubmit({
        description: description.trim(),
        name: trimmedName,
      })
      onClose()
    } catch (submitError) {
      setError(getBackendError(submitError, 'Role could not be saved.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-ink/30 px-4 py-8 backdrop-blur-sm">
      <form
        className="w-full max-w-md animate-scale-in rounded-card bg-canvas p-6 shadow-card"
        onSubmit={handleSubmit}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[20px] font-bold text-ink">
              {mode === 'edit' ? 'Edit Role' : 'Create Role'}
            </h2>
            <p className="mt-1 text-[13px] text-slate">
              {mode === 'edit'
                ? 'Update the custom role name and description.'
                : 'Create a custom role with no permissions by default.'}
            </p>
          </div>
          <button
            className="rounded-control p-2 text-slate transition hover:bg-mist hover:text-ink"
            onClick={onClose}
            type="button"
          >
            <span className="sr-only">Close</span>
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-ink">
              Name
            </span>
            <input
              className="h-11 w-full rounded-control border border-hairline bg-mist/50 px-3 text-[14px] text-ink outline-none transition focus:border-brand focus:bg-canvas focus:ring-2 focus:ring-brand/20"
              onChange={(event) => setName(event.target.value)}
              placeholder="Head Nurse"
              type="text"
              value={name}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-ink">
              Description
            </span>
            <textarea
              className="min-h-[84px] w-full resize-y rounded-control border border-hairline bg-mist/50 px-3 py-2.5 text-[14px] text-ink outline-none transition focus:border-brand focus:bg-canvas focus:ring-2 focus:ring-brand/20"
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What can this role do?"
              rows={2}
              value={description}
            />
          </label>

          <ErrorBanner message={error} />
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            className="rounded-control border border-hairline px-4 py-2.5 text-[13px] font-semibold text-slate transition hover:bg-mist hover:text-ink"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-control bg-brand px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'Saving...' : mode === 'edit' ? 'Save Role' : 'Create Role'}
          </button>
        </div>
      </form>
    </div>
  )
}

function DeleteRoleModal({ error, isDeleting, onClose, onConfirm, role }) {
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-ink/30 px-4 py-8 backdrop-blur-sm">
      <section className="w-full max-w-md animate-scale-in rounded-card bg-canvas p-6 shadow-card">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[20px] font-bold text-ink">Delete Role?</h2>
            <p className="mt-2 text-[14px] leading-6 text-slate">
              {error ||
                `This will permanently delete the ${role?.name} role. Users currently assigned to this role must be reassigned before deletion.`}
            </p>
          </div>
          <button
            className="rounded-control p-2 text-slate transition hover:bg-mist hover:text-ink"
            onClick={onClose}
            type="button"
          >
            <span className="sr-only">Close</span>
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        <div className="flex justify-end gap-3">
          <button
            className="rounded-control border border-hairline px-4 py-2.5 text-[13px] font-semibold text-slate transition hover:bg-mist hover:text-ink"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-control bg-rose-600 px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isDeleting}
            onClick={onConfirm}
            type="button"
          >
            {isDeleting ? 'Deleting...' : 'Delete Role'}
          </button>
        </div>
      </section>
    </div>
  )
}

export function AccessControl() {
  const toast = useToast()
  const { refreshSession } = useAuth()
  const [roles, setRoles] = useState([])
  const [selectedRoleId, setSelectedRoleId] = useState(null)
  const [editorPermissions, setEditorPermissions] = useState(getRolePermissions())
  const [savedPermissions, setSavedPermissions] = useState(getRolePermissions())
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [roleMenuId, setRoleMenuId] = useState(null)
  const [roleModal, setRoleModal] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  const selectedRole = useMemo(
    () => roles.find((role) => String(role.id) === String(selectedRoleId)) || null,
    [roles, selectedRoleId],
  )
  const customRoleCount = useMemo(
    () => roles.filter((role) => !role.is_system).length,
    [roles],
  )
  const showSaveBar = selectedRole

  useEffect(() => {
    let mounted = true

    async function loadRoles() {
      setIsLoading(true)
      setLoadError('')

      try {
        const response = await getRoles()
        const roleList = normalizeRoleList(response).map((role) =>
          mergeRole(role, role),
        )

        if (mounted) {
          setRoles(roleList)
        }
      } catch (error) {
        if (mounted) {
          setLoadError(getBackendError(error, 'Roles could not be loaded.'))
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    loadRoles()

    return () => {
      mounted = false
    }
  }, [])

  function selectRole(role) {
    const rolePermissions = getRolePermissions(role)

    setSelectedRoleId(role.id)
    setEditorPermissions(rolePermissions)
    setSavedPermissions(rolePermissions)
    setSaveError('')
    setRoleMenuId(null)
  }

  function updatePermission(module, access) {
    setEditorPermissions((currentPermissions) => ({
      ...currentPermissions,
      [module]: normalizeAccessLevel(access),
    }))
    setSaveError('')
  }

  async function handleSavePermissions() {
    if (!selectedRole) {
      return
    }

    setIsSaving(true)
    setSaveError('')

    const previousPermissions = savedPermissions
    const payload = {
      permissions: MODULES.map((module) => ({
        access: normalizeAccessLevel(editorPermissions[module]),
        module,
      })),
    }

    try {
      const updatedRole = await setRolePermissions(selectedRole.id, payload)
      const mergedRole = mergeRole(selectedRole, updatedRole)

      setRoles((currentRoles) =>
        currentRoles.map((role) =>
          String(role.id) === String(selectedRole.id) ? mergedRole : role,
        ),
      )
      setSavedPermissions(getRolePermissions(mergedRole))
      setEditorPermissions(getRolePermissions(mergedRole))
      toast.success('Permissions saved.')
      refreshSession().catch(() => {})
    } catch (error) {
      setEditorPermissions(previousPermissions)
      setSaveError(getBackendError(error, 'Permissions could not be saved.'))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCreateRole(roleData) {
    const createdRole = mergeRole({}, await createRole(roleData))
    const rolePermissions = getRolePermissions(createdRole)

    setRoles((currentRoles) => [...currentRoles, createdRole])
    setSelectedRoleId(createdRole.id)
    setEditorPermissions(rolePermissions)
    setSavedPermissions(rolePermissions)
    toast.success('Role created.')
  }

  async function handleUpdateRole(roleData) {
    const updatedRole = mergeRole(roleModal.role, await updateRole(roleModal.role.id, roleData))

    setRoles((currentRoles) =>
      currentRoles.map((role) =>
        String(role.id) === String(updatedRole.id) ? updatedRole : role,
      ),
    )
    toast.success('Role updated.')
  }

  async function handleDeleteRole() {
    if (!deleteTarget) {
      return
    }

    setIsDeleting(true)
    setDeleteError('')

    try {
      await deleteRole(deleteTarget.id)
      setRoles((currentRoles) =>
        currentRoles.filter((role) => String(role.id) !== String(deleteTarget.id)),
      )

      if (String(selectedRoleId) === String(deleteTarget.id)) {
        setSelectedRoleId(null)
        setEditorPermissions(getRolePermissions())
        setSavedPermissions(getRolePermissions())
      }

      setDeleteTarget(null)
      toast.success('Role deleted.')
    } catch (error) {
      setDeleteError(getBackendError(error, 'Role could not be deleted.'))
    } finally {
      setIsDeleting(false)
    }
  }

  if (loadError) {
    return (
      <section className={`${surfaceClass} p-10 text-center`}>
        <ShieldCheck aria-hidden="true" className="mx-auto mb-4 h-10 w-10 text-brand/20" />
        <h2 className="text-[18px] font-bold text-ink">Access control unavailable</h2>
        <p className="mt-2 text-[14px] text-slate">{loadError}</p>
      </section>
    )
  }

  return (
    <div className="space-y-5">
      <section className={`${surfaceClass} flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between`}>
        <div>
          <h1 className="text-[30px] font-extrabold text-ink">
            Access Control
          </h1>
          <p className="mt-2 text-[14px] leading-6 text-slate">
            Manage roles and module permissions.
          </p>
        </div>
        <button
          className="inline-flex h-11 items-center justify-center rounded-control bg-brand px-4 text-[14px] font-bold text-white shadow-sm transition hover:bg-brand-dark"
          onClick={() => setRoleModal({ mode: 'create', role: null })}
          type="button"
        >
          <Plus aria-hidden="true" className="mr-2 h-4 w-4" />
          New Role
        </button>
      </section>

      <section className="grid items-stretch gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className={`${surfaceClass} flex h-full min-h-[520px] flex-col overflow-hidden`}>
          <div className={panelHeaderClass}>
            <h2 className="text-[14px] font-semibold text-ink">
              Roles
            </h2>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, index) => <RoleSkeleton key={index} />)
            ) : (
              <>
              {roles.map((role, index) => {
                const selected = String(role.id) === String(selectedRoleId)
                const openMenuUp = index >= roles.length - 2

                return (
                  <div
                    className={[
                      'group relative flex min-h-[76px] cursor-pointer items-center gap-3 border-b border-hairline px-4 py-3 transition-colors last:border-0 hover:bg-mist',
                      selected
                        ? 'border-l-2 border-l-brand bg-brand/5 pl-[14px]'
                        : '',
                    ].join(' ')}
                    key={role.id}
                    onClick={() => selectRole(role)}
                    style={stagger(index, 0.03)}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-light text-[12px] font-bold text-brand">
                      {getInitials(role.name)}
                    </div>
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate text-[14px] font-semibold text-ink">
                          {role.name}
                        </p>
                        {role.is_system ? (
                          <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate">
                            System
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-[12px] text-slate">
                        {role.user_count || 0} users
                      </p>
                    </div>

                    {!role.is_system ? (
                      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center">
                        <button
                          className={[
                            'inline-flex h-8 w-8 items-center justify-center rounded-control border text-slate transition',
                            'border-transparent hover:border-hairline hover:bg-canvas hover:text-ink',
                            String(roleMenuId) === String(role.id)
                              ? 'border-hairline bg-canvas text-ink shadow-sm'
                              : 'group-hover:bg-white/70',
                          ].join(' ')}
                          onClick={(event) => {
                            event.stopPropagation()
                            setRoleMenuId((openId) =>
                              String(openId) === String(role.id) ? null : role.id,
                            )
                          }}
                          type="button"
                        >
                          <span className="sr-only">Role actions</span>
                          <MoreVertical aria-hidden="true" className="h-4 w-4" />
                        </button>

                        {String(roleMenuId) === String(role.id) ? (
                          <div
                            className={[
                              'absolute right-0 z-30 min-w-[148px] overflow-hidden rounded-card border border-hairline bg-canvas shadow-card',
                              openMenuUp ? 'bottom-full mb-2' : 'top-full mt-2',
                            ].join(' ')}
                            onClick={(event) => event.stopPropagation()}
                          >
                            <button
                              className="flex w-full items-center gap-2 border-b border-hairline px-3 py-2 text-left text-[13px] font-medium text-ink transition hover:bg-mist"
                              onClick={() => {
                                setRoleMenuId(null)
                                setRoleModal({ mode: 'edit', role })
                              }}
                              type="button"
                            >
                              <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
                              Edit name
                            </button>
                            <button
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-medium text-rose-600 transition hover:bg-rose-50"
                              onClick={() => {
                                setRoleMenuId(null)
                                setDeleteTarget(role)
                              }}
                              type="button"
                            >
                              <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )
              })}

              {customRoleCount === 0 ? (
                <button
                  className="m-4 w-[calc(100%-2rem)] rounded-control border border-dashed border-brand/30 bg-brand-light/40 px-4 py-5 text-center transition hover:border-brand/50 hover:bg-brand-light"
                  onClick={() => setRoleModal({ mode: 'create', role: null })}
                  type="button"
                >
                  <p className="text-[14px] font-semibold text-ink">No custom roles yet</p>
                  <p className="mt-1 text-[13px] font-semibold text-brand">
                    Create your first custom role
                  </p>
                </button>
              ) : null}
              </>
            )}
          </div>
        </aside>

        {!selectedRole ? (
          <section className={`${surfaceClass} ${emptyStateClass} h-full min-h-[520px]`}>
            <div>
              <ShieldCheck aria-hidden="true" className="mx-auto mb-4 h-10 w-10 text-brand/20" />
              <p className="text-[14px] font-semibold italic text-slate">
                Select a role to manage its permissions
              </p>
            </div>
          </section>
        ) : (
          <section className={`${surfaceClass} flex h-full min-h-[520px] flex-col overflow-hidden`}>
            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[20px] font-bold text-ink">
                      {selectedRole.name}
                    </h2>
                    {selectedRole.is_system ? (
                      <span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate">
                        System
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[13px] text-slate">
                    {selectedRole.user_count || 0} users assigned
                  </p>
                </div>

                {!selectedRole.is_system ? (
                  <button
                    className="inline-flex h-10 items-center justify-center rounded-control border border-hairline px-3 text-[13px] font-semibold text-slate transition hover:bg-mist hover:text-ink"
                    onClick={() => setRoleModal({ mode: 'edit', role: selectedRole })}
                    type="button"
                  >
                    <Pencil aria-hidden="true" className="mr-2 h-4 w-4" />
                    Edit name
                  </button>
                ) : null}
              </div>

              {selectedRole.is_system ? (
                <div className="mt-5 rounded-control border border-blue-200 bg-blue-50 px-4 py-3 text-[13px] leading-6 text-blue-800">
                  <Info aria-hidden="true" className="mr-2 inline h-4 w-4 text-blue-500" />
                  This is a system role. You can change its module permissions freely. Its
                  name cannot be renamed.
                </div>
              ) : null}

              <ErrorBanner message={saveError} />

              <div className="mt-5 divide-y divide-hairline">
                {MODULES.map((module) => {
                  const Icon = MODULE_META[module].icon

                  return (
                    <div
                      className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:gap-4"
                      key={module}
                    >
                      <div className="flex w-[150px] items-center gap-2">
                        <span className="flex h-9 w-9 items-center justify-center rounded-control bg-brand-light text-brand">
                          <Icon aria-hidden="true" className="h-4 w-4" />
                        </span>
                        <span className="text-[14px] font-medium text-ink">
                          {MODULE_META[module].label}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {ACCESS_LEVELS.map((accessLevel) => {
                          const active =
                            normalizeAccessLevel(editorPermissions[module]) ===
                            accessLevel.value
                          const meta = getAccessLevelMeta(accessLevel.value)

                          return (
                            <button
                              className={[
                                'rounded-control border px-3 py-1.5 text-[12px] font-medium transition',
                                meta.chipClass,
                                active
                                  ? 'ring-2 ring-brand/30'
                                  : 'opacity-70 hover:opacity-100',
                              ].join(' ')}
                              key={accessLevel.value}
                              onClick={() => updatePermission(module, accessLevel.value)}
                              type="button"
                            >
                              {accessLevel.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {showSaveBar ? (
              <div className="sticky bottom-0 flex flex-col gap-3 border-t border-hairline bg-canvas px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
                <button
                  className="inline-flex items-center justify-center rounded-control px-4 py-2 text-[13px] font-semibold text-slate transition hover:bg-mist hover:text-ink"
                  onClick={() => {
                    setEditorPermissions(savedPermissions)
                    setSaveError('')
                  }}
                  type="button"
                >
                  <RotateCcw aria-hidden="true" className="mr-2 h-4 w-4" />
                  Discard
                </button>
                <button
                  className="rounded-control bg-brand px-5 py-2.5 text-[13px] font-bold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSaving}
                  onClick={handleSavePermissions}
                  type="button"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            ) : null}
          </section>
        )}
      </section>

      {roleModal ? (
        <RoleModal
          existingRoles={roles}
          mode={roleModal.mode}
          onClose={() => setRoleModal(null)}
          onSubmit={roleModal.mode === 'edit' ? handleUpdateRole : handleCreateRole}
          role={roleModal.role}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteRoleModal
          error={deleteError}
          isDeleting={isDeleting}
          onClose={() => {
            setDeleteTarget(null)
            setDeleteError('')
          }}
          onConfirm={handleDeleteRole}
          role={deleteTarget}
        />
      ) : null}
    </div>
  )
}

export default AccessControl
