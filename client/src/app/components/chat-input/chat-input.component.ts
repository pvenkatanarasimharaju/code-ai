import {
  Component,
  output,
  input,
  ElementRef,
  ViewChild,
  inject,
  computed,
  signal,
  HostListener,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChatService, ProviderInfo, ProviderModel } from '../../services/chat.service';

@Component({
  selector: 'app-chat-input',
  imports: [FormsModule],
  templateUrl: './chat-input.component.html',
  styleUrl: './chat-input.component.scss',
})
export class ChatInputComponent {
  @ViewChild('textareaRef') textareaRef!: ElementRef<HTMLTextAreaElement>;
  private host = inject(ElementRef<HTMLElement>);

  sendMessage = output<string>();
  disabled = input(false);
  text = '';
  chat = inject(ChatService);

  providerMenuOpen = signal(false);
  modelMenuOpen = signal(false);

  currentModels = computed(() => {
    const providerId = this.chat.selectedProvider();
    const prov = this.chat.providers().find(p => p.id === providerId);
    return prov?.models || [];
  });

  selectedProviderLabel = computed(() => {
    const id = this.chat.selectedProvider();
    return this.chat.providers().find(p => p.id === id)?.name ?? 'Provider';
  });

  selectedModelLabel = computed(() => {
    const mid = this.chat.selectedModel();
    const m = this.currentModels().find(x => x.id === mid);
    return m?.name ?? (mid || 'Model');
  });

  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent): void {
    if (!this.host.nativeElement.contains(ev.target as Node)) {
      this.providerMenuOpen.set(false);
      this.modelMenuOpen.set(false);
    }
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') {
      this.providerMenuOpen.set(false);
      this.modelMenuOpen.set(false);
    }
  }

  toggleProviderMenu(ev: MouseEvent): void {
    ev.stopPropagation();
    const next = !this.providerMenuOpen();
    this.modelMenuOpen.set(false);
    this.providerMenuOpen.set(next);
  }

  toggleModelMenu(ev: MouseEvent): void {
    ev.stopPropagation();
    const next = !this.modelMenuOpen();
    this.providerMenuOpen.set(false);
    this.modelMenuOpen.set(next);
  }

  pickProvider(p: ProviderInfo, ev: MouseEvent): void {
    ev.stopPropagation();
    this.onProviderChange(p.id);
    this.providerMenuOpen.set(false);
  }

  pickModel(m: ProviderModel, ev: MouseEvent): void {
    ev.stopPropagation();
    this.onModelChange(m.id);
    this.modelMenuOpen.set(false);
  }

  /** Close custom selects when the user moves focus to the message field. */
  closeMenus(): void {
    this.providerMenuOpen.set(false);
    this.modelMenuOpen.set(false);
  }

  onProviderChange(providerId: string): void {
    this.chat.selectedProvider.set(providerId);
    const prov = this.chat.providers().find(p => p.id === providerId);
    if (prov) {
      this.chat.selectedModel.set(prov.defaultModel);
    }
  }

  onModelChange(modelId: string): void {
    this.chat.selectedModel.set(modelId);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  send(): void {
    const msg = this.text.trim();
    if (!msg) return;
    this.sendMessage.emit(msg);
    this.text = '';
    setTimeout(() => this.autoResize());
  }

  autoResize(): void {
    const el = this.textareaRef?.nativeElement;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 192) + 'px';
    }
  }
}
