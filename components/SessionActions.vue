<template>
  <UModal v-model:open="confirmOpen">
    <UCard>
      <template #header>
        <h3 class="font-semibold">Clear all messages?</h3>
      </template>
      <p class="text-sm text-muted">
        This will delete every message in the current session. This action cannot be undone.
      </p>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton label="Cancel" color="neutral" variant="ghost" @click="confirmOpen = false" />
          <UButton
            label="Clear"
            color="error"
            @click="confirmOpen = false; $emit('confirm')"
          />
        </div>
      </template>
    </UCard>
  </UModal>
</template>

<script setup lang="ts">
const confirmOpen = ref(false)

defineEmits<{
  confirm: []
}>()

defineExpose({ confirmOpen })
</script>
